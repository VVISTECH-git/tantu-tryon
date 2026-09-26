import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Image, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { File, Paths } from "expo-file-system";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { TANTU_MARK_GRADIENT, TANTU_MARK_PATHS, TANTU_MARK_VIEWBOX } from "@tantu/shared/brand";
import { ShotCamera, type CapturedPhoto } from "./src/ShotCamera";
import { CropView } from "./src/CropView";
import { ZoomImage } from "./src/ZoomImage";
import { QrScan } from "./src/QrScan";
import {
  DEFAULT_GARMENT_TYPE,
  garmentType as typeOf,
  garmentTypeGroups,
  requiredSlots,
  shotFor,
  shotsFor,
  type Shot,
} from "@tantu/shared/shots";
import { DEFAULT_LOOK, PRIMARY_PROMPT, type GarmentView, type RunView } from "@tantu/shared/views";
import * as api from "./src/api";
import { C, R } from "./src/theme";

/**
 * The Tantu phone app: the shop floor's half of the studio.
 *
 * Sign in with a username and password, pick the garment type, photograph the
 * saree on the rod one tile at a time, confirm, add optional shots, press
 * Generate. Same server, same shot list and same rules as the browser; the
 * phone adds the camera and keeps working when the shop's network is slow.
 */

type Screen = "splash" | "signin" | "type" | "shots" | "analyzing" | "confirm" | "flats" | "generating" | "result" | "account" | "saved" | "platform";

const PRICE_1K = 10_00;
const PRICE_2K = 20_00;

/* The poses the server has Case 1 wording for. P5 is left out while testing (25 Sep). */
const POSES = [
  { id: "P1", title: "Front, symmetrical" },
  { id: "P2", title: "Three-quarter, hand on hip" },
  { id: "P3", title: "Back view, head in profile" },
  { id: "P4", title: "Waist up, pallu detail" },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <Studio />
    </SafeAreaProvider>
  );
}

function Studio() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<"username" | "password" | "product" | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  // "photographer": products and photos only, nothing that spends.
  const [role, setRole] = useState("admin");
  const photographer = role === "photographer";
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [platform, setPlatform] = useState<api.PlatformSettings | null>(null);
  const [pickModel, setPickModel] = useState<string | null>(null);
  const [grantShop, setGrantShop] = useState<string | null>(null);
  const [grantRupees, setGrantRupees] = useState("100");
  const [platformNote, setPlatformNote] = useState<string | null>(null);
  const [accountBack, setAccountBack] = useState<Screen>("type");
  const [scanning, setScanning] = useState(false);
  const [pose, setPose] = useState<string>(PRIMARY_PROMPT);
  // The newest finished image per pose, for the Generated sign on each pose.
  const [madeByPose, setMadeByPose] = useState<Record<string, string>>({});

  // A product opened from Saved products goes Back to that list, not to the product ID screen.
  const [shotsBack, setShotsBack] = useState<Screen>("type");
  const [garmentType, setGarmentType] = useState(DEFAULT_GARMENT_TYPE);
  const [productId, setProductId] = useState("");
  const [lateId, setLateId] = useState("");
  const [saved, setSaved] = useState<api.SavedProduct[] | null>(null);
  const [garment, setGarment] = useState<GarmentView | null>(null);
  // A newer update is fetched and applied on this open, not the next one, so
  // the phone never needs the open-close-reopen routine. Only while nothing
  // is in hand (splash, sign-in, product ID screen): never mid-product.
  const idle = useRef(true);
  idle.current = (screen === "splash" || screen === "signin" || screen === "type") && garment === null;
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    void (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (idle.current) await Updates.reloadAsync();
      } catch {
        // Offline or the update server is down: carry on with this version.
      }
    })();
  }, []);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [cameraShot, setCameraShot] = useState<Shot | null>(null);
  const [cropPick, setCropPick] = useState<{ shot: Shot; photo: api.LocalPhoto } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<{ title: string; body: string }[]>([]);
  const [primary, setPrimary] = useState<RunView | null>(null);
  const [howShot, setHowShot] = useState<Shot | null>(null);
  const [viewing, setViewing] = useState<{ uri: string; label: string } | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const batch = useRef(api.newKey());

  // Splash for at least 2.2s (same as the web studio), while a stored
  // session is checked in the background; whichever finishes last decides
  // when the splash gives way to sign-in or straight into the studio.
  const skipSplash = useRef<() => void>(() => undefined);
  // The sign-in card sits at the bottom of the page; on iPhone the keyboard
  // covered it, so typing went on blind (25 Sep). Bring it up above the keys.
  const mainScroll = useRef<ScrollView>(null);
  const showSigninCard = () => setTimeout(() => mainScroll.current?.scrollToEnd({ animated: true }), 350);
  useEffect(() => {
    if (screen !== "splash") return;
    let target: Screen | null = null;
    let timerDone = false;
    const finish = () => {
      if (target && timerDone) setScreen(target);
    };
    // A tap skips the wait, not the session check: a signed-in person goes
    // straight in instead of to the sign-in page.
    skipSplash.current = () => {
      timerDone = true;
      finish();
    };
    const timer = setTimeout(() => {
      timerDone = true;
      finish();
    }, 2200);
    void (async () => {
      const token = await api.loadToken();
      if (!token) {
        target = "signin";
        return finish();
      }
      try {
        const me = await api.account();
        setBalance(me.balancePaise);
        setSignedInAs(me.username ?? me.name);
        setRole(me.role);
        setPlatformAdmin(me.platformAdmin);
        target = "type";
      } catch {
        target = "signin";
      }
      finish();
    })();
    return () => clearTimeout(timer);
  }, [screen]);

  async function signIn() {
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(username.trim(), password);
      const me = await api.account();
      setBalance(me.balancePaise);
      setSignedInAs(me.username ?? me.name);
      setRole(me.role);
      setPlatformAdmin(me.platformAdmin);
      setPassword("");
      setScreen("type");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * One step back from each screen. From the first screen there is nowhere
   * to go, so Android's back button leaves the app as usual; everywhere else
   * it steps back instead of closing the app mid-product.
   */
  function backFrom(from: Screen): Screen | null {
    switch (from) {
      case "shots":
        return shotsBack;
      case "saved":
        return "type";
      case "confirm":
        return "shots";
      case "flats":
        return "confirm";
      case "result":
        return "flats";
      case "account":
        return accountBack;
      case "platform":
        return "account";
      default:
        return null;
    }
  }
  const backTarget = backFrom(screen);
  function goBack(to: Screen) {
    if (to === "saved") void showSaved();
    else setScreen(to);
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (cameraShot || cropPick || viewing || howShot || typeOpen || scanning) return false;
      if (screen === "analyzing" || screen === "generating") return true;
      const to = backFrom(screen);
      if (!to) return false;
      goBack(to);
      return true;
    });
    return () => sub.remove();
  });

  // Not while analyzing or generating: those screens move on by themselves when the call returns.
  function openAccount() {
    if (screen === "analyzing" || screen === "generating" || screen === "account") return;
    // From Platform, Account's Back must still lead to where the person came
    // from, not back to Platform (which loops: 25 Sep).
    if (screen !== "platform") setAccountBack(screen);
    setScreen("account");
    void refreshBalance();
  }

  async function openPlatform() {
    setScreen("platform");
    setPlatform(null);
    setPlatformNote(null);
    try {
      const p = await api.platformSettings();
      setPlatform(p);
      setPickModel(p.chosen);
      setGrantShop((current) => current ?? p.shops.find((sh) => sh.house)?.id ?? p.shops[0]?.id ?? null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load the platform settings.");
    }
  }

  async function saveModel() {
    if (!pickModel) return;
    setBusy(true);
    setPlatformNote(null);
    try {
      await api.chooseModel(pickModel);
      setPlatform((p) => (p ? { ...p, chosen: pickModel } : p));
      const o = platform?.options.find((x) => x.id === pickModel);
      setPlatformNote(`Model saved: ${o ? `${o.name} · ${o.detail}` : pickModel}. Every new image uses it.`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not save the model.");
    } finally {
      setBusy(false);
    }
  }

  async function grant() {
    const rupees = Number(grantRupees);
    if (!grantShop || !(rupees > 0)) return;
    setBusy(true);
    setPlatformNote(null);
    try {
      await api.grantCredit(grantShop, rupees);
      const p = await api.platformSettings();
      setPlatform(p);
      const shop = p.shops.find((sh) => sh.id === grantShop);
      setPlatformNote(`Granted ₹${rupees} to ${shop?.name ?? "the shop"}. Balance now ${api.rupees(shop?.balancePaise ?? 0)}.`);
      void refreshBalance();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not grant the credit.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshBalance() {
    try {
      setBalance((await api.account()).balancePaise);
    } catch {
      // keep the last number
    }
  }

  // ── Photographs ─────────────────────────────────────────────────────────

  /** The photo library only; the shutter goes through Tantu's own camera screen (ShotCamera) instead of the OS one. */
  async function pickFromLibrary(shot: Shot) {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access in Settings to pick a photo.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false, allowsEditing: false };
    const result = await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setCropPick({ shot, photo: { uri: asset.uri, width: asset.width, height: asset.height, mimeType: asset.mimeType ?? undefined } });
  }

  async function shotCaptured(photo: CapturedPhoto) {
    const shot = cameraShot;
    setCameraShot(null);
    if (!shot) return;
    await upload(shot, photo);
  }

  /**
   * Send the photo as the camera made it: no resize, no recompression. Only
   * a HEIC from the library is turned into a JPEG, at full size and full
   * quality, because the server cannot read HEIC.
   */
  async function upload(shot: Shot, photo: api.LocalPhoto) {
    setBusySlot(shot.slot);
    try {
      let sent = photo;
      if (/hei[cf]/i.test(photo.mimeType ?? "")) {
        const rendered = await ImageManipulator.manipulate(photo.uri).renderAsync();
        const saved = await rendered.saveAsync({ compress: 1, format: SaveFormat.JPEG });
        sent = { uri: saved.uri, width: saved.width, height: saved.height, mimeType: "image/jpeg" };
      }
      const fresh = garment?.id ?? null;
      const result = await api.uploadPart(sent, shot.slot, fresh, garmentType);
      if (!fresh) {
        setPrimary(null);
        batch.current = api.newKey();
      }
      setGarment(result.garment);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Upload failed.");
    } finally {
      setBusySlot(null);
    }
  }

  function clear(shot: Shot) {
    if (!garment) return;
    Alert.alert(`Remove the ${shot.label.toLowerCase()} photo?`, "You can take or upload it again afterwards.", [
      { text: "Keep", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void removeNow(shot) },
    ]);
  }

  async function removeNow(shot: Shot) {
    if (!garment) return;
    setBusySlot(shot.slot);
    try {
      setGarment(await api.removePart(garment.id, shot.slot));
    } finally {
      setBusySlot(null);
    }
  }

  async function analyzeNow() {
    if (!garment) return;
    setBusy(true);
    setError(null);
    setScreen("analyzing");
    try {
      const analysis = await api.analyze(garment.id);
      setGarment(analysis.garment);
      setWarnings(analysis.warnings);
      setScreen("confirm");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not analyze the photos.");
      setScreen("shots");
    } finally {
      setBusy(false);
    }
  }

  async function generatePrimary(fresh = false) {
    if (!garment) return;
    const key = fresh ? `again-${api.newKey()}` : `${batch.current}-${pose}`;
    setBusy(true);
    setError(null);
    setScreen("generating");
    try {
      const run = await api.generate(garment.id, pose, DEFAULT_LOOK, key);
      setPrimary(run);
      setScreen("result");
    } catch (problem) {
      setPrimary({
        id: "",
        status: "failed",
        imageUrl: null,
        error: problem instanceof Error ? problem.message : "The render failed.",
        ms: null,
        model: "",
        promptId: pose,
        promptVersion: "",
        look: DEFAULT_LOOK,
        verdict: null,
        note: "",
        startedAt: new Date().toISOString(),
        clientKey: key,
        creditsPaise: 0,
      });
      setScreen("result");
    } finally {
      setBusy(false);
      void refreshBalance();
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await api.logout();
    } finally {
      setGarment(null);
      setPrimary(null);
      setWarnings([]);
      setOpened(new Set());
      setBalance(null);
      setSignedInAs(null);
      setRole("admin");
      setPlatformAdmin(false);
      setPlatform(null);
      setUsername("");
      setPassword("");
      setProductId("");
      setLateId("");
      setAccountBack("type");
      setShotsBack("type");
      setBusy(false);
      setScreen("signin");
    }
  }

  /** The record for this product ID, made on first use, reopened after. */
  async function openProduct(scanned?: string) {
    const id = (scanned ?? productId).trim();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const g = await api.openProduct(id, garmentType);
      setGarment(g);
      setGarmentType(g.garmentType);
      setPrimary(null);
      setWarnings([]);
      batch.current = api.newKey();
      setShotsBack("type");
      setScreen("shots");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not open the product.");
    } finally {
      setBusy(false);
    }
  }

  async function saveLateId() {
    if (!garment || !lateId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const g = await api.setProductId(garment.id, lateId.trim());
      setGarment(g);
      setProductId(g.productCode ?? "");
      setLateId("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not save the product ID.");
    } finally {
      setBusy(false);
    }
  }

  async function openWithoutId() {
    setBusy(true);
    setError(null);
    try {
      const g = await api.openWithoutProductId(garmentType);
      setGarment(g);
      setProductId("");
      setPrimary(null);
      setWarnings([]);
      batch.current = api.newKey();
      setShotsBack("type");
      setScreen("shots");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function showSaved() {
    setScreen("saved");
    setSaved(null);
    try {
      setSaved(await api.savedProducts());
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load the saved products.");
      setSaved([]);
    }
  }

  async function reopen(item: api.SavedProduct) {
    setBusy(true);
    try {
      const g = await api.getGarment(item.id);
      setGarment(g);
      setGarmentType(g.garmentType);
      setProductId(g.productCode ?? "");
      setPrimary(null);
      setWarnings([]);
      batch.current = api.newKey();
      setShotsBack("saved");
      setScreen("shots");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not open the product.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * The finished image onto the phone: downloaded full size, then the share
   * sheet, whose "Save Image" puts it in Photos (and WhatsApp, AirDrop...).
   * Android's share sheet takes no files here, so it opens the image instead.
   */
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!garment || (screen !== "flats" && screen !== "result")) return;
    let live = true;
    api
      .listRuns(garment.id)
      .then((runs) => {
        if (!live) return;
        const made: Record<string, string> = {};
        for (const r of [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
          if (r.status === "done" && r.imageUrl) made[r.promptId] = r.imageUrl;
        }
        setMadeByPose(made);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [garment?.id, screen]);
  /** The finished image, downloaded full size into the phone's cache. */
  async function downloadImage(url: string, name: string): Promise<File> {
    const dest = new File(Paths.cache, `${name.replace(/[^A-Za-z0-9_-]+/g, "-")}.jpg`);
    if (dest.exists) dest.delete();
    return File.downloadFileAsync(url, dest);
  }

  /** Save: straight into Photos (build 1.0.1 carries the media library). */
  async function saveImage(url: string, name: string) {
    setSaving(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert("Photos access is off", "Allow Tantu to add photos in Settings → Tantu → Photos, then try again.");
        return;
      }
      const file = await downloadImage(url, name);
      await MediaLibrary.saveToLibraryAsync(file.uri);
      Alert.alert("Saved to Photos");
    } catch (problem) {
      Alert.alert("Could not save the image", problem instanceof Error ? problem.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  /** Forward: the phone's share sheet (WhatsApp, AirDrop, ...). Android opens the image instead. */
  async function shareImage(url: string, name: string) {
    if (Platform.OS !== "ios") {
      void Linking.openURL(url);
      return;
    }
    setSaving(true);
    try {
      const file = await downloadImage(url, name);
      await Share.share({ url: file.uri });
    } catch (problem) {
      Alert.alert("Could not share the image", problem instanceof Error ? problem.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  function startOver() {
    setPose(PRIMARY_PROMPT);
    setProductId("");
    setGarment(null);
    setPrimary(null);
    setWarnings([]);
    setOpened(new Set());
    batch.current = api.newKey();
    setScreen("type");
  }

  // ── Derived ─────────────────────────────────────────────────────────────

  const parts = garment?.parts ?? [];
  const has = (slot: string) => parts.some((p) => p.slot === slot);
  const required = requiredSlots(garmentType);
  const missing = required.filter((slot) => !has(slot));
  const blocked = required.filter((slot) => parts.find((p) => p.slot === slot)?.quality?.status === "block");
  const label = (slot: string) => shotFor(garmentType, slot)?.label ?? slot;
  const ready = garment !== null && missing.length === 0 && blocked.length === 0 && busySlot === null;
  const price = PRICE_1K;
  const groups = useMemo(() => garmentTypeGroups(), []);
  const { width: deviceW } = useWindowDimensions();

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.page} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      {screen !== "splash" && screen !== "signin" && (
        <View style={s.header}>
          <Text style={s.brand}>
            Tantu <Text style={s.brandSub}>Try-On</Text>
          </Text>
          <View style={s.row}>
            {photographer ? (
              <View style={s.chip}>
                <Text style={s.chipText}>{signedInAs ?? "photographer"}</Text>
              </View>
            ) : (
              <>
                <Pressable style={s.chip} onPress={openAccount} hitSlop={6}>
                  <Text style={s.chipText}>{balance === null ? "…" : `${api.rupees(balance)} left`}</Text>
                </Pressable>
                <Pressable onPress={openAccount} hitSlop={8}>
                  <Text style={s.link}>Account</Text>
                </Pressable>
              </>
            )}
            <Pressable onPress={() => void signOut()} hitSlop={8} disabled={screen === "analyzing" || screen === "generating"} style={{ opacity: screen === "analyzing" || screen === "generating" ? 0.35 : 1 }}>
              <Text style={s.link}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView ref={mainScroll} contentContainerStyle={s.main} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {error && screen !== "signin" && <Text style={s.error}>{error}</Text>}

        {backTarget && screen !== "account" && (
          <View style={s.navRow}>
            <Pressable onPress={() => goBack(backTarget)} hitSlop={10} accessibilityLabel="Back">
              <Text style={s.navBack}>‹ Back</Text>
            </Pressable>
            {garment?.productCode && screen !== "saved" && screen !== "shots" ? (
              <View style={s.navId}>
                <Text style={s.navIdText}>{garment.productCode}</Text>
              </View>
            ) : null}
          </View>
        )}

        {screen === "splash" && <Splash onSkip={() => skipSplash.current()} deviceW={deviceW} />}

        {screen === "signin" && (
          <View style={s.signin}>
            <View style={s.signinBrand}>
              <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
                <View style={[s.splashGlow, s.signinGlowOuter]} pointerEvents="none" />
                <View style={[s.splashGlow, s.signinGlowMid]} pointerEvents="none" />
                <View style={[s.splashGlow, s.signinGlowInner]} pointerEvents="none" />
                <TantuMark size={72} />
              </View>
              <Text style={s.signinName}>Tantu</Text>
              <Text style={s.signinTagline}>AI Studio for Fashion Brands</Text>
            </View>

            <View style={s.fan} pointerEvents="none">
              <Image source={{ uri: `${api.API_BASE}/splash/b_1.jpg` }} style={[s.fanCard, { left: 6, top: 12, transform: [{ rotate: "-11deg" }] }]} />
              <Image source={{ uri: `${api.API_BASE}/splash/b_5.jpg` }} style={[s.fanCard, { right: 6, top: 12, transform: [{ rotate: "10deg" }] }]} />
              <Image source={{ uri: `${api.API_BASE}/splash/b_3.jpg` }} style={[s.fanCard, s.fanCentre]} />
            </View>

            <View style={s.signinCard}>
              <Text style={s.signinTitle}>Sign in to your studio</Text>
              <View style={s.field}>
                <Text style={s.fieldLabel}>Username</Text>
                <TextInput
                  style={[s.input, focused === "username" && s.inputFocus]}
                  value={username}
                  onChangeText={setUsername}
                  onFocus={() => {
                    setFocused("username");
                    showSigninCard();
                  }}
                  onBlur={() => setFocused(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  submitBehavior="submit"
                />
              </View>
              <View style={s.field}>
                <Text style={s.fieldLabel}>Password</Text>
                <View>
                  <TextInput
                    ref={passwordRef}
                    style={[s.input, { paddingRight: 72 }, focused === "password" && s.inputFocus]}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => {
                      setFocused("password");
                      showSigninCard();
                    }}
                    onBlur={() => setFocused(null)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={() => void signIn()}
                  />
                  <Pressable style={s.fieldToggle} onPress={() => setShowPassword((v) => !v)} hitSlop={6}>
                    <Text style={s.fieldToggleText}>{showPassword ? "Hide" : "Show"}</Text>
                  </Pressable>
                </View>
              </View>
              {error && <Text style={s.signinError}>{error}</Text>}
              <Action label={busy ? "Signing in…" : "Sign in"} disabled={busy || !username.trim() || !password} onPress={() => void signIn()} />
            </View>
            {__DEV__ && <Text style={s.support}>{api.API_BASE.replace(/^https?:\/\//, "")}</Text>}
          </View>
        )}

        {screen === "type" && (
          <View style={s.stack}>
            <Text style={s.title}>Which product?</Text>
            <Text style={s.copy}>Every photo you take next is saved against this product ID.</Text>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Product ID</Text>
              <View style={[s.row, { gap: 8 }]}>
              <TextInput
                style={[s.input, { flex: 1 }, focused === "product" && s.inputFocus]}
                value={productId}
                onChangeText={setProductId}
                onFocus={() => setFocused("product")}
                onBlur={() => setFocused(null)}
                placeholder="e.g. 300010"
                placeholderTextColor={C.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void openProduct()}
              />
              <Chip label="Scan" accent disabled={busy} onPress={() => setScanning(true)} />
              </View>
            </View>
            <Text style={s.sectionLabel}>Garment type</Text>
            <Pressable style={s.select} onPress={() => setTypeOpen(true)}>
              <Text style={s.selectText}>{typeOf(garmentType).label}</Text>
              <Text style={s.selectChevron}>⌄</Text>
            </Pressable>
            <Text style={s.support}>Saree is live. The other types are coming soon.</Text>
            <Action label={busy ? "Opening…" : "Continue to photos"} disabled={busy || !productId.trim()} onPress={() => void openProduct()} />
            <Pressable onPress={() => void openWithoutId()} disabled={busy} hitSlop={8} style={{ alignSelf: "center" }}>
              <Text style={s.link}>Continue without product ID</Text>
            </Pressable>
            <Secondary label="Saved products" onPress={() => void showSaved()} />
          </View>
        )}

        {screen === "saved" && (
          <View style={s.stack}>
            <Text style={s.title}>Saved products</Text>
            <Text style={s.copy}>Every product ID with the photos saved against it. Tap one to add or retake photos.</Text>
            {saved === null ? (
              <Spinner text="Loading…" />
            ) : saved.length === 0 ? (
              <Text style={s.support}>Nothing saved yet.</Text>
            ) : (
              saved.map((item) => (
                <Pressable key={item.id} style={s.savedRow} onPress={() => void reopen(item)} disabled={busy}>
                  <View style={s.savedThumb}>{item.thumb ? <Image source={{ uri: item.thumb }} style={s.fill} /> : null}</View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.shotName}>{item.productId ?? "No product ID"}</Text>
                    <Text style={s.shotWhere}>
                      {item.photos} photo{item.photos === 1 ? "" : "s"}
                      {item.slots.length ? ` · ${item.slots.map((slot) => shotFor(item.garmentType, slot)?.label ?? slot).join(", ")}` : ""}
                    </Text>
                    <Text style={[s.shotWhere, { color: item.missing.length ? C.warn : C.good }]}>
                      {item.missing.length ? `Missing: ${item.missing.map((slot) => shotFor(item.garmentType, slot)?.label ?? slot).join(", ")}` : "Required photos in"}
                    </Text>
                  </View>
                  <Text style={s.selectChevron}>›</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        {screen === "shots" && (
          <View style={s.stack}>
            <Text style={s.title}>{typeOf(garmentType).label} photos</Text>
            {garment?.productCode ? (
              <View style={s.savedUnder}>
                <Text style={s.savedUnderText}>Saving under product ID</Text>
                <Text style={s.savedUnderId}>{garment.productCode}</Text>
              </View>
            ) : garment ? (
              <View style={s.lateId}>
                <Text style={s.lateIdTitle}>No product ID yet</Text>
                <Text style={s.support}>Add one now or later. The photos are kept either way.</Text>
                <View style={[s.row, { gap: 8 }]}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={lateId}
                    onChangeText={setLateId}
                    placeholder="Product ID"
                    placeholderTextColor={C.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    onSubmitEditing={() => void saveLateId()}
                  />
                  <Chip label="Save ID" accent disabled={busy || !lateId.trim()} onPress={() => void saveLateId()} />
                </View>
              </View>
            ) : null}
            <Text style={s.copy}>Hang it once. Only the phone moves.</Text>
            <Text style={s.status}>
              {required.length - missing.length} of {required.length} required
              {blocked.length > 0 ? ` · ${blocked.length === 1 ? "1 needs a retake" : `${blocked.length} need a retake`}` : ""}
            </Text>
            <ShotList
              type={garmentType}
              garment={garment}
              busySlot={busySlot}
              opened={opened}
              onOpen={(slot) => setOpened((prev) => new Set(prev).add(slot))}
              onFold={(slot) => setOpened((prev) => { const next = new Set(prev); next.delete(slot); return next; })}
              onCamera={(shot) => setCameraShot(shot)}
              onUpload={(shot) => void pickFromLibrary(shot)}
              onClear={(shot) => void clear(shot)}
              onHow={setHowShot}
                onView={(uri, label) => setViewing({ uri, label })}
            />
            <Text style={s.support}>Camera opens the phone camera. Upload picks a photo already on the phone.</Text>
            {photographer ? (
              <>
                <Text style={s.support}>
                  {missing.length > 0
                    ? `Still needed: ${missing.map(label).join(" and ")}.`
                    : blocked.length > 0
                      ? `Retake ${blocked.map(label).join(" and ")}.`
                      : `All photos are saved under ${garment?.productCode ?? "this product"}.`}
                </Text>
                <Action label="Done · next product" disabled={busySlot !== null} onPress={startOver} />
              </>
            ) : (
            <Action
              label={
                missing.length > 0
                  ? `Continue · add ${missing.map(label).join(" and ")} first`
                  : blocked.length > 0
                    ? `Continue · retake ${blocked.map(label).join(" and ")} first`
                    : busySlot
                      ? "Checking the photo…"
                      : "Continue"
              }
              disabled={!ready || busy}
              onPress={() => void analyzeNow()}
            />
            )}
          </View>
        )}

        {screen === "analyzing" && <Spinner text="Analyzing your garment. This may take a few seconds." sub="Keep this screen open and your phone unlocked." />}

        {screen === "confirm" && garment && (
          <View style={s.stack}>
            <Text style={s.title}>Confirm your photos</Text>
            <Text style={s.copy}>
              {parts.length === 1 ? "1 photo" : `${parts.length} photos`} of a {typeOf(garment.garmentType).label.toLowerCase()}. Tap a photo to see it full size; Add more or Back to change them.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
              {shotsFor(garment.garmentType)
                .filter((shot) => has(shot.slot))
                .map((shot) => {
                  const part = parts.find((p) => p.slot === shot.slot)!;
                  const state = part.quality?.status ?? null;
                  return (
                    <Pressable key={shot.slot} style={s.stripItem} onPress={() => setViewing({ uri: part.url, label: shot.label })}>
                      <View style={[s.stripThumb, state === "warn" && s.warnBorder, state === "block" && s.badBorder]}>
                        <Image source={{ uri: part.url }} style={s.fill} />
                        {state && <View style={[s.dot, s.dotAbs, { backgroundColor: state === "ok" ? C.good : state === "warn" ? C.warn : C.bad }]} />}
                      </View>
                      <Text style={s.stripLabel}>{shot.label}</Text>
                    </Pressable>
                  );
                })}
              <Pressable style={s.stripItem} onPress={() => setScreen("shots")}>
                <View style={[s.stripThumb, s.stripAdd]}>
                  <Text style={s.plus}>+</Text>
                </View>
                <Text style={s.stripLabel}>Add more</Text>
              </Pressable>
            </ScrollView>
            <Text style={s.support}>Garment type: {typeOf(garment.garmentType).label}</Text>
            {warnings.map((w) => (
              <View key={w.title} style={s.warning}>
                <Text style={s.warningTitle}>{w.title}</Text>
                <Text style={s.warningBody}>{w.body}</Text>
              </View>
            ))}
            <Action label="Looks correct, continue?" onPress={() => setScreen("flats")} />
          </View>
        )}

        {screen === "flats" && garment && (
          <View style={s.stack}>
            <Text style={s.title}>Additional photos</Text>
            <Text style={s.copy}>Add these if you have them, for accuracy and better styling. Don’t worry if you don’t.</Text>
            <ShotList
              type={garment.garmentType}
              garment={garment}
              busySlot={busySlot}
              optionalOnly
              opened={opened}
              onOpen={(slot) => setOpened((prev) => new Set(prev).add(slot))}
              onFold={(slot) => setOpened((prev) => { const next = new Set(prev); next.delete(slot); return next; })}
              onCamera={(shot) => setCameraShot(shot)}
              onUpload={(shot) => void pickFromLibrary(shot)}
              onClear={(shot) => void clear(shot)}
              onHow={setHowShot}
                onView={(uri, label) => setViewing({ uri, label })}
            />
            {balance !== null && balance < price && <Text style={s.support}>Your current plan balance is over. Purchase a plan to continue.</Text>}
            <Text style={s.sectionLabel}>Pose</Text>
            <View style={{ gap: 8 }}>
              {POSES.map((p) => {
                const on = pose === p.id;
                return (
                  <Pressable key={p.id} onPress={() => setPose(p.id)} style={[s.modelRow, on && s.modelRowOn]}>
                    <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                    <Text style={[s.shotName, { flex: 1 }]}>
                      {p.id} <Text style={s.shotWhere}>· {p.title}</Text>
                    </Text>
                    {madeByPose[p.id] ? (
                      <Pressable
                        onPress={() => setViewing({ uri: madeByPose[p.id]!, label: `${p.id} image` })}
                        hitSlop={8}
                        style={[s.madeChip, s.madeChipOn]}
                        accessibilityLabel={`Generated. View the ${p.id} image`}
                      >
                        <View style={[s.dot, { backgroundColor: C.good }]} />
                        <Text style={[s.madeText, { color: C.good }]}>Generated · View</Text>
                      </Pressable>
                    ) : (
                      <View style={s.madeChip}>
                        <View style={[s.dot, { backgroundColor: C.textMuted }]} />
                        <Text style={s.madeText}>Not yet</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Action label={`Generate ${pose}`} disabled={busy || busySlot !== null || (balance !== null && balance < price)} onPress={() => void generatePrimary()} />
          </View>
        )}

        {screen === "generating" && <Spinner text="Generating your image. This can take up to a minute." sub="Keep this screen open and your phone unlocked." />}

        {screen === "account" && (
          <View style={s.stack}>
            <Text style={s.title}>Account</Text>
            <View style={s.card}>
              <View style={s.kv}>
                <Text style={s.kvLabel}>Signed in as</Text>
                <Text style={s.kvValue}>{signedInAs ?? "…"}</Text>
              </View>
              <View style={s.kv}>
                <Text style={s.kvLabel}>Balance</Text>
                <Text style={[s.kvValue, s.kvBig]}>{balance === null ? "…" : api.rupees(balance)}</Text>
              </View>
              <Text style={s.kvLabel}>Images you can make with this balance</Text>
              <View style={s.row}>
                <View style={s.count}>
                  <Text style={s.kvLabel}>1K · {api.rupees(PRICE_1K)} each</Text>
                  <Text style={s.kvBig}>{balance === null ? "…" : Math.floor(balance / PRICE_1K)}</Text>
                </View>
                <View style={s.count}>
                  <Text style={s.kvLabel}>2K · {api.rupees(PRICE_2K)} each</Text>
                  <Text style={s.kvBig}>{balance === null ? "…" : Math.floor(balance / PRICE_2K)}</Text>
                </View>
              </View>
            </View>
            {platformAdmin && <Action label="Platform settings" onPress={() => void openPlatform()} />}
            <Secondary label="Back" onPress={() => setScreen(accountBack)} />
          </View>
        )}

        {screen === "platform" && (
          <View style={s.stack}>
            <Text style={s.title}>Platform</Text>
            <Text style={s.copy}>Tantu’s own settings, for every shop. Only you see this.</Text>
            {platformNote && <Text style={[s.support, { color: C.good }]}>{platformNote}</Text>}
            {!platform ? (
              <Spinner text="Reading Google's prices…" />
            ) : (
              <>
                <Text style={s.sectionLabel}>Image model</Text>
                <Text style={s.support}>
                  Prices per image from Google, {platform.prices.source === "live" ? "read just now" : "from the last reading"} · $1 = ₹{platform.rate.inrPerUsd.toFixed(2)}
                </Text>
                <View style={{ gap: 8 }}>
                  {platform.options.map((o) => {
                    const on = pickModel === o.id;
                    const inUse = platform.chosen === o.id;
                    return (
                      <Pressable
                        key={o.id}
                        disabled={!o.selectable}
                        onPress={() => setPickModel(o.id)}
                        style={[s.modelRow, on && s.modelRowOn, !o.selectable && { opacity: 0.45 }]}
                      >
                        <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.shotName}>
                            {o.name} <Text style={s.shotWhere}>· {o.detail}</Text>
                          </Text>
                          {inUse && <Text style={[s.shotWhere, { color: C.good }]}>In use</Text>}
                        </View>
                        <Text style={s.modelPrice}>{o.normalPaise == null ? "–" : `₹${(o.normalPaise / 100).toFixed(2)}`}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Action label={busy ? "Saving…" : "Save model"} disabled={busy || !pickModel || pickModel === platform.chosen} onPress={() => void saveModel()} />

                <Text style={[s.sectionLabel, { marginTop: 10 }]}>Grant credit</Text>
                <View style={{ gap: 8 }}>
                  {platform.shops.map((sh) => {
                    const on = grantShop === sh.id;
                    return (
                      <Pressable key={sh.id} onPress={() => setGrantShop(sh.id)} style={[s.modelRow, on && s.modelRowOn]}>
                        <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.shotName}>{sh.name}</Text>
                          <Text style={s.shotWhere}>{sh.owner ?? "no login"}{sh.house ? " · Tantu's own" : ""}</Text>
                        </View>
                        <Text style={s.modelPrice}>{api.rupees(sh.balancePaise)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={[s.row, { gap: 8 }]}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={grantRupees}
                    onChangeText={(t) => setGrantRupees(t.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder="Rupees"
                    placeholderTextColor={C.textMuted}
                  />
                  <Chip label={busy ? "…" : "Grant"} accent disabled={busy || !grantShop || !(Number(grantRupees) > 0)} onPress={() => void grant()} />
                </View>
              </>
            )}
          </View>
        )}

        {screen === "result" && primary && (
          <View style={s.stack}>
            {primary.status === "done" && primary.imageUrl ? (
              <>
                <Text style={s.title}>Your image is ready</Text>
                <Text style={s.support}>
                  {primary.promptId} · {POSES.find((p) => p.id === primary.promptId)?.title ?? ""}
                </Text>
                <Text style={s.copy}>Download the result or start a new garment.</Text>
                <View style={s.frame}>
                  <Pressable style={s.fill} onPress={() => setViewing({ uri: primary.imageUrl!, label: "Your image" })}>
                    <Image source={{ uri: primary.imageUrl }} style={s.fill} resizeMode="cover" />
                  </Pressable>
                </View>
                <Action
                  label={saving ? "Saving…" : "Save to Photos"}
                  disabled={saving}
                  onPress={() => void saveImage(primary.imageUrl!, `${garment?.productCode ?? "tantu"}-${primary.promptId}`)}
                />
                <Secondary
                  label="Forward"
                  disabled={saving}
                  onPress={() => void shareImage(primary.imageUrl!, `${garment?.productCode ?? "tantu"}-${primary.promptId}`)}
                />
                <Secondary label="Open full size" onPress={() => setViewing({ uri: primary.imageUrl!, label: "Your image" })} />
              </>
            ) : (
              <>
                <Text style={s.title}>{primary.status === "refused" ? "Generation blocked" : "Generation failed"}</Text>
                <Text style={s.copy}>{primary.error ?? "We could not generate the image right now. Please try again."}</Text>
                <Text style={s.support}>Nothing was charged for this.</Text>
                <Action label="Try again" disabled={busy} onPress={() => void generatePrimary(true)} />
              </>
            )}
            <Secondary label="Next product" onPress={startOver} />
          </View>
        )}
      </ScrollView>

      {/* Garment type picker */}
      <Modal visible={typeOpen} transparent animationType="fade" onRequestClose={() => setTypeOpen(false)}>
        {/* The close-on-tap layer sits behind the sheet, not around it: wrapped in a
            Pressable, the sheet's list could not scroll on iPhone (25 Sep). */}
        <View style={s.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTypeOpen(false)} accessibilityLabel="Close" />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Garment type</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {(Object.keys(groups) as (keyof typeof groups)[]).map((group) => (
                <View key={group}>
                  <Text style={s.groupLabel}>{group}</Text>
                  {groups[group].map((o) => (
                    <Pressable
                      key={o.value}
                      disabled={!o.enabled}
                      style={[s.option, o.value === garmentType && s.optionSelected]}
                      onPress={() => {
                        setGarmentType(o.value);
                        setTypeOpen(false);
                      }}
                    >
                      <Text style={[s.optionText, !o.enabled && s.optionSoon]}>{o.enabled ? o.label : `${o.label} · Soon`}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* A photo from the library, cropped (or not) before it is saved */}
      <Modal visible={cropPick !== null} animationType="slide" onRequestClose={() => setCropPick(null)} statusBarTranslucent>
        {cropPick && (
          <CropView
            photo={cropPick.photo}
            onCancel={() => setCropPick(null)}
            onDone={(p) => {
              const pick = cropPick;
              setCropPick(null);
              void upload(pick.shot, { uri: p.uri, width: p.width, height: p.height, mimeType: p.mimeType });
            }}
          />
        )}
      </Modal>

      {/* A captured photo, full screen */}
      <Modal visible={viewing !== null} animationType="fade" onRequestClose={() => setViewing(null)} statusBarTranslucent>
        {viewing && (
          <View style={s.viewer}>
            <ZoomImage uri={viewing.uri} />
            <View style={s.viewerBar}>
              <Text style={s.viewerLabel}>{viewing.label}</Text>
              {/* Forward: the share sheet. Save: straight into Photos. */}
              <Pressable
                onPress={() => void shareImage(viewing.uri, `${garment?.productCode ?? "tantu"}-${viewing.label}`)}
                disabled={saving}
                hitSlop={10}
                style={{ marginLeft: "auto", marginRight: 20 }}
                accessibilityLabel="Forward"
              >
                <Text style={s.viewerSave}>Forward</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveImage(viewing.uri, `${garment?.productCode ?? "tantu"}-${viewing.label}`)}
                disabled={saving}
                hitSlop={10}
                style={{ marginRight: 22 }}
                accessibilityLabel="Save"
              >
                <Text style={s.viewerSave}>{saving ? "…" : "Save"}</Text>
              </Pressable>
              <Pressable onPress={() => setViewing(null)} hitSlop={12} accessibilityLabel="Close">
                <Text style={s.viewerClose}>✕</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Modal>

      {/* Product tag scanner: the code only fills the Product ID box; the person checks it and taps Continue */}
      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)} statusBarTranslucent>
        {scanning && (
          <QrScan
            onCancel={() => setScanning(false)}
            onCode={(code) => {
              setScanning(false);
              setProductId(code);
            }}
          />
        )}
      </Modal>

      {/* How to shoot */}
      <Modal visible={howShot !== null} transparent animationType="fade" onRequestClose={() => setHowShot(null)}>
        <View style={s.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setHowShot(null)} accessibilityLabel="Close" />
          {howShot && (
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>How to shoot the {howShot.label.toLowerCase()}</Text>
              <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 10, alignItems: "center" }}>
                {howShot.frame && (
                  <>
                    <Image source={{ uri: `${api.API_BASE}${howShot.frame}` }} style={s.howFrame} resizeMode="contain" />
                    <Text style={s.support}>On the rod, phone straight ahead. Frame it like this.</Text>
                  </>
                )}
                <Image source={{ uri: `${api.API_BASE}${howShot.sample}` }} style={howShot.orientation === "upright" ? s.howPhotoUpright : s.howPhotoSideways} resizeMode="cover" />
                <Orientation orientation={howShot.orientation} large />
                <Text style={s.howWhere}>{howShot.where}</Text>
                <Text style={s.howCopy}>{howShot.how}</Text>
                {howShot.gives && <Text style={s.howCopy}>{howShot.gives}</Text>}
              </ScrollView>
              <Action label="OK" compact onPress={() => setHowShot(null)} />
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={cameraShot !== null} animationType="slide" onRequestClose={() => setCameraShot(null)}>
        {cameraShot && <ShotCamera shot={cameraShot} onCapture={(photo) => void shotCaptured(photo)} onClose={() => setCameraShot(null)} />}
      </Modal>
    </SafeAreaView>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────

/**
 * The splash: the mark, the name, the tagline over a warm glow, and the
 * same five-photo collage the web demo shows — same photos
 * (/splash/b_1..5.jpg), same rough layout: two cards up top, one large one
 * centred over them, two more along the bottom, each tilted a few degrees.
 * Sized off the device width the way the web version caps at 440px.
 */
/**
 * The web splash (studio.css .st-splash-shots), card for card: the same five
 * photographs at the same sizes, offsets and tilts, so the outer four tuck
 * under the centre card the way they do in the browser. The web switches to
 * a smaller set below 780px of height; here the web's full-size set is scaled
 * down just enough to fit the screen below the mark, never above web size.
 */
function Splash({ onSkip, deviceW }: { onSkip: () => void; deviceW: number }) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(deviceW - 40, 440);
  const above = 310; // padding, mark, name, tagline and the gap above the cards
  const k = Math.max(0.72, Math.min(1, (winH - insets.top - insets.bottom - above) / 560));
  const H = 560 * k;
  const small = 130 * k;
  const smallH = (small * 4) / 3;
  const big = 186 * k;
  const bigH = (big * 4) / 3;
  const photo = (n: number) => `${api.API_BASE}/splash/b_${n}.jpg`;
  const cards: { src: string; style: object; z?: number }[] = [
    { src: photo(1), style: { left: 0, top: 12 * k, width: small, height: smallH, transform: [{ rotate: "-10deg" }] } },
    { src: photo(2), style: { right: 0, top: 0, width: small, height: smallH, transform: [{ rotate: "9deg" }] } },
    { src: photo(3), style: { left: W / 2 - big / 2, top: 150 * k, width: big, height: bigH, transform: [{ rotate: "-2deg" }] }, z: 2 },
    { src: photo(4), style: { left: W * 0.03, top: H - smallH, width: small, height: smallH, transform: [{ rotate: "7deg" }] } },
    { src: photo(5), style: { right: W * 0.03, top: H - smallH - 6 * k, width: small, height: smallH, transform: [{ rotate: "-8deg" }] } },
  ];
  return (
    <Pressable style={s.splash} onPress={onSkip}>
      <View style={{ alignItems: "center", gap: 10 }}>
        <View style={{ width: 84, height: 84, alignItems: "center", justifyContent: "center" }}>
          <View style={[s.splashGlow, s.splashGlowOuter]} pointerEvents="none" />
          <View style={[s.splashGlow, s.splashGlowMid]} pointerEvents="none" />
          <View style={[s.splashGlow, s.splashGlowInner]} pointerEvents="none" />
          <TantuMark size={84} />
        </View>
        <Text style={s.splashName}>Tantu</Text>
        <Text style={s.splashTagline}>AI Studio for Fashion Brands</Text>
      </View>
      <View style={{ width: W, height: H, marginTop: 30 }}>
        {cards.map((c, i) => (
          <View key={i} style={[s.splashShot, c.style, c.z ? { zIndex: c.z, elevation: 10 } : null]}>
            <Image source={{ uri: c.src }} style={s.fill} resizeMode="cover" />
          </View>
        ))}
      </View>
    </Pressable>
  );
}

/** The script T, the same drawing the web uses (packages/shared/src/brand.ts). */
function TantuMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox={TANTU_MARK_VIEWBOX}>
      <Defs>
        <LinearGradient id="tantu-mark" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={TANTU_MARK_GRADIENT[0]} />
          <Stop offset="1" stopColor={TANTU_MARK_GRADIENT[1]} />
        </LinearGradient>
      </Defs>
      {TANTU_MARK_PATHS.map((d, i) => (
        <Path key={i} d={d} fill="url(#tantu-mark)" />
      ))}
    </Svg>
  );
}

function ShotList({
  type,
  garment,
  busySlot,
  optionalOnly,
  opened,
  onOpen,
  onFold,
  onCamera,
  onUpload,
  onClear,
  onHow,
  onView,
}: {
  type: string;
  garment: GarmentView | null;
  busySlot: string | null;
  optionalOnly?: boolean;
  opened: Set<string>;
  onOpen: (slot: string) => void;
  onFold?: (slot: string) => void;
  onCamera: (shot: Shot) => void;
  onUpload: (shot: Shot) => void;
  onClear: (shot: Shot) => void;
  onHow: (shot: Shot) => void;
  onView: (uri: string, label: string) => void;
}) {
  let shots = shotsFor(type);
  if (optionalOnly) shots = shots.filter((sh) => !sh.required);
  const part = (slot: string) => garment?.parts.find((p) => p.slot === slot) ?? null;
  const visible = shots.filter((sh) => sh.required || part(sh.slot) || opened.has(sh.slot));
  const folded = shots.filter((sh) => !visible.includes(sh));
  return (
    <View style={{ gap: 10 }}>
      {visible.map((shot) => {
        const p = part(shot.slot);
        const state = p?.quality?.status ?? (p ? "ok" : null);
        const busy = busySlot === shot.slot;
        const headline = p?.quality?.reasons[0]?.message.split(".")[0] ?? "";
        const full = p?.quality?.reasons.map((r) => r.message).join(" ") ?? "";
        return (
          <View key={shot.slot} style={[s.shot, state === "warn" && s.warnBorder, state === "block" && s.badBorder]}>
            <Pressable style={s.shotThumb} onPress={() => (p ? onView(p.url, shot.label) : onCamera(shot))}>
              {p ? (
                <Image source={{ uri: p.url }} style={s.fill} />
              ) : (
                <>
                  <Image source={{ uri: `${api.API_BASE}${shot.frame ?? shot.sample}` }} style={[s.fill, { opacity: 0.38 }]} />
                  <Text style={[s.plus, s.plusAbs]}>+</Text>
                </>
              )}
              {busy && (
                <View style={s.shotBusy}>
                  <ActivityIndicator color={C.accentStrong} />
                </View>
              )}
            </Pressable>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={s.row}>
                <Text style={s.shotName}>{shot.label}</Text>
                <View style={[s.tag, shot.required ? s.tagRequired : s.tagOptional]}>
                  <Text style={[s.tagText, shot.required ? { color: "#ffd9c2" } : { color: C.textMuted }]}>{shot.required ? "REQUIRED" : "OPTIONAL"}</Text>
                </View>
              </View>
              {state ? (
                <View style={s.row}>
                  <View style={[s.dot, { backgroundColor: state === "ok" ? C.good : state === "warn" ? C.warn : C.bad }]} />
                  <Text style={[s.check, { color: state === "ok" ? C.good : state === "warn" ? C.warn : C.bad }]}>{state === "ok" ? "Looks good" : headline}</Text>
                </View>
              ) : (
                <View style={[s.row, { flexWrap: "wrap" }]}>
                  <Orientation orientation={shot.orientation} />
                  <Text style={s.shotWhere}>{shot.where}</Text>
                </View>
              )}
              {state && state !== "ok" && full !== `${headline}.` && <Text style={s.checkCopy}>{full}</Text>}
              <View style={[s.row, { flexWrap: "wrap" }]}>
                {p ? (
                  <>
                    <Chip label="Retake" accent={state === "block"} disabled={busy} onPress={() => onCamera(shot)} />
                    <Chip label="Upload" disabled={busy} onPress={() => onUpload(shot)} />
                    <Chip label="Remove" disabled={busy} onPress={() => onClear(shot)} />
                  </>
                ) : (
                  <>
                    <Chip label="Camera" accent disabled={busy} onPress={() => onCamera(shot)} />
                    <Chip label="Upload" disabled={busy} onPress={() => onUpload(shot)} />
                  </>
                )}
                <Pressable onPress={() => onHow(shot)}>
                  <Text style={s.link}>How</Text>
                </Pressable>
                {!shot.required && !p && onFold && (
                  <Pressable onPress={() => onFold(shot.slot)} hitSlop={6}>
                    <Text style={s.link}>Hide</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        );
      })}
      {folded.length > 0 && (
        <View style={s.more}>
          <Text style={s.moreLabel}>Optional. Add the ones this saree has:</Text>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {folded.map((shot) => (
              <Chip key={shot.slot} label={`+ ${shot.label}`} onPress={() => onOpen(shot.slot)} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Orientation({ orientation, large }: { orientation: "upright" | "sideways"; large?: boolean }) {
  const k = large ? 1.7 : 1;
  return (
    <View style={[s.ori, large && { paddingHorizontal: 12, paddingVertical: 4 }]}>
      <View style={{ width: (orientation === "upright" ? 7 : 11) * k, height: (orientation === "upright" ? 11 : 7) * k, borderWidth: 1.5, borderColor: C.text, borderRadius: 2 }} />
      <Text style={[s.oriText, large && { fontSize: 13 }]}>{orientation === "upright" ? "Upright" : "Sideways"}</Text>
    </View>
  );
}

function Action({ label, onPress, disabled, compact }: { label: string; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  return (
    <Pressable style={[s.action, compact && { minHeight: 46 }, disabled && { opacity: 0.55 }]} disabled={disabled} onPress={onPress}>
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}

function Secondary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[s.secondary, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
      <Text style={s.secondaryText}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, onPress, accent, disabled }: { label: string; onPress: () => void; accent?: boolean; disabled?: boolean }) {
  return (
    <Pressable style={[s.chipBtn, accent && s.chipAccent, disabled && { opacity: 0.5 }]} disabled={disabled} onPress={onPress}>
      <Text style={[s.chipBtnText, accent && { color: "#f8ebdf" }]}>{label}</Text>
    </Pressable>
  );
}

function Spinner({ text, sub }: { text: string; sub?: string }) {
  return (
    <View style={[s.stack, { alignItems: "center", paddingTop: 80 }]}>
      <ActivityIndicator size="large" color={C.accentStrong} />
      <Text style={[s.copy, { maxWidth: 280 }]}>{text}</Text>
      {sub && <Text style={s.support}>{sub}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.page },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  brand: { color: C.text, fontSize: 18, fontWeight: "600" },
  brandSub: { color: C.textMuted, fontSize: 12, fontWeight: "400" },
  chip: { paddingHorizontal: 12, minHeight: 30, borderRadius: R.pill, backgroundColor: "rgba(107, 52, 179, 0.16)", borderWidth: 1, borderColor: "rgba(107, 52, 179, 0.24)", justifyContent: "center" },
  chipText: { color: C.violetText, fontSize: 12, fontWeight: "500" },
  main: { padding: 20, paddingBottom: 120, gap: 16 },
  stack: { gap: 12 },
  title: { color: C.text, fontSize: 26, fontWeight: "600", textAlign: "center", lineHeight: 30 },
  copy: { color: C.textSoft, fontSize: 14, textAlign: "center", lineHeight: 20 },
  support: { color: C.textMuted, fontSize: 13, textAlign: "center", lineHeight: 18 },
  status: { color: C.textSoft, fontSize: 13, textAlign: "center" },
  error: { color: "#ff8d8d", fontSize: 13, textAlign: "center" },
  sectionLabel: { color: C.textMuted, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", fontWeight: "600" },
  input: { minHeight: 52, borderRadius: R.md, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: "#0c0c0d", color: C.text, paddingHorizontal: 16, fontSize: 16 },
  select: { minHeight: 52, borderRadius: R.md, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: "#0c0c0d", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectText: { color: C.text, fontSize: 15 },
  selectChevron: { color: C.textSoft, fontSize: 18, marginTop: -6 },
  action: { minHeight: 52, borderRadius: R.pill, backgroundColor: C.actionTop, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  actionText: { color: "#fff8f1", fontSize: 15, fontWeight: "500", textAlign: "center" },
  secondary: { minHeight: 46, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: C.text, fontSize: 14, fontWeight: "500" },
  shot: { flexDirection: "row", gap: 12, padding: 10, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: C.border },
  shotThumb: { width: 64, height: 84, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  shotBusy: { position: "absolute", inset: 0, backgroundColor: "rgba(15,15,16,0.6)", alignItems: "center", justifyContent: "center" },
  fill: { width: "100%", height: "100%" },
  plus: { color: C.text, fontSize: 26 },
  plusAbs: { position: "absolute", textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: -4 },
  navBack: { color: C.accentPale, fontSize: 15, fontWeight: "600" },
  navId: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(240,141,66,0.35)", backgroundColor: "rgba(240,141,66,0.1)" },
  navIdText: { color: C.accentPale, fontSize: 12, fontWeight: "700" },
  lateId: { gap: 8, padding: 14, borderRadius: R.md, borderWidth: 1, borderColor: C.warnBorder, backgroundColor: "rgba(224,162,58,0.08)" },
  lateIdTitle: { color: C.warn, fontSize: 14, fontWeight: "700", textAlign: "center" },
  modelRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: "rgba(255,255,255,0.03)" },
  modelRowOn: { borderColor: "rgba(240,141,66,0.6)", backgroundColor: "rgba(240,141,66,0.08)" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.textMuted, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: C.accentStrong },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accentStrong },
  madeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: C.border },
  madeChipOn: { borderColor: "rgba(143,224,182,0.5)", backgroundColor: "rgba(143,224,182,0.1)" },
  madeText: { color: C.textMuted, fontSize: 13, fontWeight: "600" },
  modelPrice: { color: C.text, fontSize: 14, fontWeight: "700" },
  savedUnder: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(240,141,66,0.35)", backgroundColor: "rgba(240,141,66,0.1)" },
  savedUnderText: { color: C.textSoft, fontSize: 12 },
  savedUnderId: { color: C.accentPale, fontSize: 14, fontWeight: "700" },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: "rgba(255,255,255,0.03)" },
  savedThumb: { width: 52, height: 68, borderRadius: 10, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.05)" },
  viewer: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
  viewerBar: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: 48, paddingBottom: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.55)" },
  viewerLabel: { color: "#fff", fontSize: 16, fontWeight: "600" },
  viewerSave: { color: C.accentStrong, fontSize: 16, fontWeight: "700" },
  viewerClose: { color: "#fff", fontSize: 22, width: 28, textAlign: "center" },
  signin: { alignItems: "center", gap: 24, paddingTop: 44 },
  signinGlowOuter: { width: 140, height: 140, marginLeft: -70, marginTop: -70, borderRadius: 70, backgroundColor: "rgba(240,141,66,0.05)" },
  signinGlowMid: { width: 100, height: 100, marginLeft: -50, marginTop: -50, borderRadius: 50, backgroundColor: "rgba(240,141,66,0.07)" },
  signinGlowInner: { width: 62, height: 62, marginLeft: -31, marginTop: -31, borderRadius: 31, backgroundColor: "rgba(240,141,66,0.09)" },
  signinBrand: { alignItems: "center", gap: 8 },
  signinName: { color: C.text, fontSize: 34, fontWeight: "700", letterSpacing: -0.5, marginTop: 4 },
  signinTagline: { color: C.textSoft, fontSize: 15, fontWeight: "600" },
  fan: { width: 220, height: 128 },
  fanCard: { position: "absolute", width: 78, height: 104, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  fanCentre: { left: 64, top: 0, width: 92, height: 123, transform: [{ rotate: "-2deg" }] },
  signinCard: { alignSelf: "stretch", gap: 14, padding: 18, paddingTop: 20, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, backgroundColor: "rgba(255,255,255,0.035)" },
  signinTitle: { color: C.text, fontSize: 17, fontWeight: "600", textAlign: "center", marginBottom: 2 },
  field: { gap: 6 },
  fieldLabel: { color: C.textMuted, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  inputFocus: { borderColor: "rgba(240,141,66,0.65)" },
  fieldToggle: { position: "absolute", right: 8, top: 0, bottom: 0, justifyContent: "center", paddingHorizontal: 10 },
  fieldToggleText: { color: C.accentPale, fontSize: 13, fontWeight: "600" },
  signinError: { color: "#ffb3ad", fontSize: 13.5, textAlign: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: R.sm, borderWidth: 1, borderColor: "rgba(227,73,73,0.4)", backgroundColor: "rgba(179,56,56,0.12)", overflow: "hidden" },
  card: { padding: 16, gap: 14, borderRadius: R.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  kv: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  kvLabel: { color: C.textMuted, fontSize: 13 },
  kvValue: { color: C.text, fontSize: 15, fontWeight: "600" },
  kvBig: { color: C.text, fontSize: 22, fontWeight: "600" },
  count: { flex: 1, gap: 4, padding: 12, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, backgroundColor: "rgba(255,255,255,0.03)" },
  shotName: { color: C.text, fontSize: 14, fontWeight: "600" },
  shotWhere: { color: C.textMuted, fontSize: 12, flexShrink: 1 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.pill },
  tagRequired: { backgroundColor: "rgba(219,113,36,0.22)" },
  tagOptional: { backgroundColor: "rgba(255,255,255,0.06)" },
  tagText: { fontSize: 10, letterSpacing: 0.8, fontWeight: "700" },
  dot: { width: 9, height: 9, borderRadius: R.pill },
  dotAbs: { position: "absolute", right: 6, top: 6, width: 10, height: 10, borderWidth: 2, borderColor: "rgba(15,15,16,0.9)" },
  check: { fontSize: 12, fontWeight: "600" },
  checkCopy: { color: C.textSoft, fontSize: 12, lineHeight: 17 },
  warnBorder: { borderColor: C.warnBorder },
  badBorder: { borderColor: C.badBorder },
  chipBtn: { minHeight: 32, paddingHorizontal: 12, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)", justifyContent: "center" },
  chipAccent: { backgroundColor: "rgba(219,113,36,0.16)", borderColor: "rgba(219,113,36,0.24)" },
  chipBtnText: { color: C.text, fontSize: 12, fontWeight: "500" },
  link: { color: C.accentPale, fontSize: 12, fontWeight: "600", textDecorationLine: "underline", marginLeft: 4 },
  ori: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 7, paddingVertical: 1, borderRadius: R.pill, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  oriText: { color: C.text, fontSize: 11, fontWeight: "600" },
  more: { gap: 8, padding: 12, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.02)" },
  moreLabel: { color: C.textMuted, fontSize: 12 },
  strip: { gap: 10, paddingVertical: 4 },
  stripItem: { alignItems: "center", gap: 6 },
  stripThumb: { width: 86, height: 112, borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  stripAdd: { borderStyle: "dashed" },
  stripLabel: { color: C.textSoft, fontSize: 11 },
  warning: { padding: 14, borderRadius: 18, backgroundColor: "rgba(179,56,56,0.12)", borderWidth: 1, borderColor: "rgba(227,73,73,0.3)", gap: 6 },
  warningTitle: { color: "#ffb4b4", fontSize: 15, fontWeight: "600" },
  warningBody: { color: C.textSoft, fontSize: 13, lineHeight: 18 },
  frame: { width: "100%", aspectRatio: 3 / 4, borderRadius: R.lg, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: C.border },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 12 },
  sheet: { width: "100%", maxWidth: 400, borderRadius: R.lg, backgroundColor: "rgba(20,20,22,0.98)", borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 },
  sheetTitle: { color: C.text, fontSize: 17, fontWeight: "500", textAlign: "center" },
  groupLabel: { color: C.textMuted, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginTop: 8, marginBottom: 4 },
  option: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: R.sm },
  optionSelected: { backgroundColor: "rgba(219,113,36,0.14)" },
  optionText: { color: C.text, fontSize: 15 },
  optionSoon: { color: C.textMuted },
  howFrame: { width: "100%", aspectRatio: 4 / 5, borderRadius: R.md, backgroundColor: "#fff" },
  howPhotoUpright: { width: "46%", aspectRatio: 3 / 4, borderRadius: R.md },
  howPhotoSideways: { width: "70%", aspectRatio: 4 / 3, borderRadius: R.md },
  howWhere: { color: C.text, fontSize: 15, fontWeight: "600", textAlign: "center" },
  howCopy: { color: C.textSoft, fontSize: 14, lineHeight: 20 },
  splash: { flex: 1, alignItems: "center", paddingTop: 64, paddingHorizontal: 20, paddingBottom: 24 },
  splashGlow: { position: "absolute", left: "50%", top: "50%" },
  splashGlowOuter: { width: 190, height: 190, marginLeft: -95, marginTop: -95, borderRadius: 95, backgroundColor: "rgba(240,141,66,0.06)" },
  splashGlowMid: { width: 130, height: 130, marginLeft: -65, marginTop: -65, borderRadius: 65, backgroundColor: "rgba(240,141,66,0.08)" },
  splashGlowInner: { width: 80, height: 80, marginLeft: -40, marginTop: -40, borderRadius: 40, backgroundColor: "rgba(240,141,66,0.10)" },
  splashName: { color: C.text, fontSize: 40, fontWeight: "700", letterSpacing: -0.5 },
  splashTagline: { color: C.textSoft, fontSize: 18, fontWeight: "600" },
  splashShot: { position: "absolute", borderRadius: 18, overflow: "hidden", backgroundColor: "#1d1d1f", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});
