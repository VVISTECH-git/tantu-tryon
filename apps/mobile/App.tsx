import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
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
 * Sign in with the shared passcode, pick the garment type, photograph the
 * saree on the rod one tile at a time, confirm, add optional shots, press
 * Generate. Same server, same shot list and same rules as the browser; the
 * phone adds the camera and keeps working when the shop's network is slow.
 */

type Screen = "splash" | "signin" | "type" | "shots" | "analyzing" | "confirm" | "flats" | "generating" | "result";

const LONG_SIDE = 2000;

export default function App() {
  return (
    <SafeAreaProvider>
      <Studio />
    </SafeAreaProvider>
  );
}

function Studio() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [passcode, setPasscode] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [garmentType, setGarmentType] = useState(DEFAULT_GARMENT_TYPE);
  const [garment, setGarment] = useState<GarmentView | null>(null);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<{ title: string; body: string }[]>([]);
  const [primary, setPrimary] = useState<RunView | null>(null);
  const [howShot, setHowShot] = useState<Shot | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const batch = useRef(api.newKey());

  // Splash for at least 2.2s (same as the web studio), while a stored
  // session is checked in the background; whichever finishes last decides
  // when the splash gives way to sign-in or straight into the studio.
  useEffect(() => {
    if (screen !== "splash") return;
    let target: Screen | null = null;
    let timerDone = false;
    const finish = () => {
      if (target && timerDone) setScreen(target);
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
        target = "type";
      } catch {
        target = "signin";
      }
      finish();
    })();
    return () => clearTimeout(timer);
  }, [screen]);

  async function signIn() {
    if (!passcode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(passcode.trim());
      const me = await api.account();
      setBalance(me.balancePaise);
      setPasscode("");
      setScreen("type");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not sign in.");
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

  async function pick(shot: Shot, camera: boolean) {
    setError(null);
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(camera ? "Allow the camera in Settings to photograph the saree." : "Allow photo access in Settings to pick a photo.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false, allowsEditing: false };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await upload(shot, { uri: asset.uri, width: asset.width, height: asset.height });
  }

  /** Shrink to a 2000px long side as the browser does, then send. */
  async function upload(shot: Shot, photo: api.LocalPhoto) {
    setBusySlot(shot.slot);
    try {
      let sent = photo;
      const long = Math.max(photo.width, photo.height);
      if (long > LONG_SIDE) {
        const scale = LONG_SIDE / long;
        const context = ImageManipulator.manipulate(photo.uri);
        context.resize({ width: Math.round(photo.width * scale), height: Math.round(photo.height * scale) });
        const rendered = await context.renderAsync();
        const saved = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
        sent = { uri: saved.uri, width: saved.width, height: saved.height };
      }
      const fresh = garment?.source === "upload" && garment.garmentType === garmentType ? garment.id : null;
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

  async function clear(shot: Shot) {
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
    const key = fresh ? `again-${api.newKey()}` : `${batch.current}-${PRIMARY_PROMPT}`;
    setBusy(true);
    setError(null);
    setScreen("generating");
    try {
      const run = await api.generate(garment.id, PRIMARY_PROMPT, DEFAULT_LOOK, key);
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
        promptId: PRIMARY_PROMPT,
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

  function startOver() {
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
  const price = 10_00;
  const groups = useMemo(() => garmentTypeGroups(), []);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.page} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      {screen !== "splash" && screen !== "signin" && (
        <View style={s.header}>
          <Text style={s.brand}>
            Tantu <Text style={s.brandSub}>Try-On</Text>
          </Text>
          <View style={s.chip}>
            <Text style={s.chipText}>{balance === null ? "…" : `${api.rupees(balance)} left`}</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={s.main} keyboardShouldPersistTaps="handled">
        {error && <Text style={s.error}>{error}</Text>}

        {screen === "splash" && (
          <Pressable style={s.splash} onPress={() => setScreen("signin")}>
            <View style={s.splashMark}>
              <Text style={s.splashMarkGlyph}>T</Text>
            </View>
            <Text style={s.splashName}>Tantu</Text>
            <Text style={s.splashTagline}>AI Studio for Fashion Brands</Text>
          </Pressable>
        )}

        {screen === "signin" && (
          <View style={s.stack}>
            <Text style={s.title}>Tantu</Text>
            <Text style={s.copy}>Enter the studio passcode.</Text>
            <TextInput
              style={s.input}
              value={passcode}
              onChangeText={setPasscode}
              placeholder="Passcode"
              placeholderTextColor={C.textMuted}
              secureTextEntry
              autoCapitalize="none"
              onSubmitEditing={() => void signIn()}
            />
            <Action label={busy ? "Please wait…" : "Sign in"} disabled={busy || !passcode.trim()} onPress={() => void signIn()} />
            <Text style={s.support}>{api.API_BASE.replace(/^https?:\/\//, "")}</Text>
          </View>
        )}

        {screen === "type" && (
          <View style={s.stack}>
            <Text style={s.title}>What are you uploading?</Text>
            <Text style={s.copy}>Pick the garment type first. It decides which photos we ask for.</Text>
            <Text style={s.sectionLabel}>Garment type</Text>
            <Pressable style={s.select} onPress={() => setTypeOpen(true)}>
              <Text style={s.selectText}>{typeOf(garmentType).label}</Text>
              <Text style={s.selectChevron}>⌄</Text>
            </Pressable>
            <Text style={s.support}>Saree is live. The other types are coming soon.</Text>
            <Action label="Continue to photos" onPress={() => setScreen("shots")} />
          </View>
        )}

        {screen === "shots" && (
          <View style={s.stack}>
            <Text style={s.title}>{typeOf(garmentType).label} photos</Text>
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
              onCamera={(shot) => void pick(shot, true)}
              onUpload={(shot) => void pick(shot, false)}
              onClear={(shot) => void clear(shot)}
              onHow={setHowShot}
            />
            <Text style={s.support}>Camera opens the phone camera. Upload picks a photo already on the phone.</Text>
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
          </View>
        )}

        {screen === "analyzing" && <Spinner text="Analyzing your garment. This may take a few seconds." sub="Keep this screen open and your phone unlocked." />}

        {screen === "confirm" && garment && (
          <View style={s.stack}>
            <Text style={s.title}>Confirm your photos</Text>
            <Text style={s.copy}>
              {parts.length === 1 ? "1 photo" : `${parts.length} photos`} of a {typeOf(garment.garmentType).label.toLowerCase()}. Tap a photo to change it.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
              {shotsFor(garment.garmentType)
                .filter((shot) => has(shot.slot))
                .map((shot) => {
                  const part = parts.find((p) => p.slot === shot.slot)!;
                  const state = part.quality?.status ?? null;
                  return (
                    <Pressable key={shot.slot} style={s.stripItem} onPress={() => setScreen("shots")}>
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
            <View style={s.select}>
              <Text style={s.selectText}>{typeOf(garment.garmentType).label}</Text>
            </View>
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
              onCamera={(shot) => void pick(shot, true)}
              onUpload={(shot) => void pick(shot, false)}
              onClear={(shot) => void clear(shot)}
              onHow={setHowShot}
            />
            {balance !== null && balance < price && <Text style={s.support}>Your current plan balance is over. Purchase a plan to continue.</Text>}
            <Action label="Generate" disabled={busy || busySlot !== null || (balance !== null && balance < price)} onPress={() => void generatePrimary()} />
          </View>
        )}

        {screen === "generating" && <Spinner text="Generating your image. This can take up to a minute." sub="Keep this screen open and your phone unlocked." />}

        {screen === "result" && primary && (
          <View style={s.stack}>
            {primary.status === "done" && primary.imageUrl ? (
              <>
                <Text style={s.title}>Your image is ready</Text>
                <Text style={s.copy}>Download the result or start a new garment.</Text>
                <View style={s.frame}>
                  <Image source={{ uri: primary.imageUrl }} style={s.fill} resizeMode="cover" />
                </View>
                <Secondary label="Open full size" onPress={() => void Linking.openURL(primary.imageUrl!)} />
              </>
            ) : (
              <>
                <Text style={s.title}>{primary.status === "refused" ? "Generation blocked" : "Generation failed"}</Text>
                <Text style={s.copy}>{primary.error ?? "We could not generate the image right now. Please try again."}</Text>
                <Text style={s.support}>Nothing was charged for this.</Text>
                <Action label="Try again" disabled={busy} onPress={() => void generatePrimary(true)} />
              </>
            )}
            <Secondary label="Start a New Garment" onPress={startOver} />
          </View>
        )}
      </ScrollView>

      {/* Garment type picker */}
      <Modal visible={typeOpen} transparent animationType="fade" onRequestClose={() => setTypeOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setTypeOpen(false)}>
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
        </Pressable>
      </Modal>

      {/* How to shoot */}
      <Modal visible={howShot !== null} transparent animationType="fade" onRequestClose={() => setHowShot(null)}>
        <Pressable style={s.backdrop} onPress={() => setHowShot(null)}>
          {howShot && (
            <Pressable style={s.sheet} onPress={() => undefined}>
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
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────

function ShotList({
  type,
  garment,
  busySlot,
  optionalOnly,
  opened,
  onOpen,
  onCamera,
  onUpload,
  onClear,
  onHow,
}: {
  type: string;
  garment: GarmentView | null;
  busySlot: string | null;
  optionalOnly?: boolean;
  opened: Set<string>;
  onOpen: (slot: string) => void;
  onCamera: (shot: Shot) => void;
  onUpload: (shot: Shot) => void;
  onClear: (shot: Shot) => void;
  onHow: (shot: Shot) => void;
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
            <Pressable style={s.shotThumb} onPress={() => (p ? onUpload(shot) : onCamera(shot))}>
              {p ? (
                <Image source={{ uri: p.url }} style={s.fill} />
              ) : (
                <>
                  <Image source={{ uri: `${api.API_BASE}${shot.sample}` }} style={[s.fill, { opacity: 0.38 }]} />
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

function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={s.secondary} onPress={onPress}>
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
  main: { padding: 20, gap: 16 },
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
  splash: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 60 },
  splashMark: { width: 84, height: 84, borderRadius: 22, backgroundColor: C.actionTop, alignItems: "center", justifyContent: "center" },
  splashMarkGlyph: { color: "#fff8f1", fontSize: 40, fontWeight: "800" },
  splashName: { color: C.text, fontSize: 40, fontWeight: "700", letterSpacing: -0.5 },
  splashTagline: { color: C.textSoft, fontSize: 18, fontWeight: "600" },
});
