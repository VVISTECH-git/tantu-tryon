import { CameraView, useCameraPermissions } from "expo-camera";
import * as SecureStore from "expo-secure-store";
import { DeviceMotion } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Shot } from "@tantu/shared/shots";
import { CropView } from "./CropView";
import { C, R } from "./theme";

/**
 * Tantu's own camera, not the phone's.
 *
 * What you see is what you get: the preview sits in a window shaped like the
 * photo (3:4), so no edge of the saree hides past the screen's sides. The
 * phone's motion sensor says whether it is held straight and still — the
 * corners turn green when it is — and the shutter waits a moment for the
 * phone to settle. On phones with a wide lens, 0.5× fits a saree in a tight
 * space; the choice is remembered.
 */

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

const WIDE_KEY = "tantu.wideLens";
/** Degrees off straight that still count as straight. */
const TILT_OK = 4;
const ROLL_OK = 3;
/** Degrees per second of turning that still count as still. */
const STILL_OK = 12;

interface Pose {
  /** How far the camera points up or down, degrees. */
  tilt: number;
  /** How far the phone is turned in its own plane, degrees. */
  roll: number;
  /** Held the way the shot asks: upright, or sideways. */
  rightWay: boolean;
  still: boolean;
}

export function ShotCamera({ shot, onCapture, onClose }: { shot: Shot; onCapture: (photo: CapturedPhoto) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [cropping, setCropping] = useState(false);
  const [lenses, setLenses] = useState<string[]>([]);
  const [wide, setWide] = useState(false);
  const [pose, setPose] = useState<Pose | null>(null);
  const poseRef = useRef<Pose | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const upright = shot.orientation === "upright";

  const ultraWide = lenses.find((l) => /ultra\s*wide/i.test(l));

  useEffect(() => {
    void SecureStore.getItemAsync(WIDE_KEY).then((v) => setWide(v === "1"));
  }, []);

  // Straight and still, from the motion sensor, ten times a second.
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    const turning: number[] = [];
    void DeviceMotion.isAvailableAsync().then((ok) => {
      if (!ok) return;
      DeviceMotion.setUpdateInterval(100);
      sub = DeviceMotion.addListener((m) => {
        const g = m.accelerationIncludingGravity;
        if (!g) return;
        const mag = Math.hypot(g.x, g.y, g.z) || 1;
        const along = upright ? Math.abs(g.y) : Math.abs(g.x);
        const across = upright ? Math.abs(g.x) : Math.abs(g.y);
        const rate = m.rotationRate ? Math.hypot(m.rotationRate.alpha ?? 0, m.rotationRate.beta ?? 0, m.rotationRate.gamma ?? 0) : 0;
        turning.push(rate);
        if (turning.length > 6) turning.shift();
        const next: Pose = {
          tilt: (Math.asin(Math.min(1, Math.abs(g.z) / mag)) * 180) / Math.PI,
          roll: (Math.atan2(across, along) * 180) / Math.PI,
          rightWay: along >= across,
          still: Math.max(...turning) < STILL_OK,
        };
        poseRef.current = next;
        setPose(next);
      });
    });
    return () => sub?.remove();
  }, [upright]);

  const level = pose ? pose.rightWay && pose.tilt < TILT_OK && pose.roll < ROLL_OK : false;
  const ready = level && !!pose?.still;
  const hint = !pose
    ? shot.where
    : !pose.rightWay
      ? upright
        ? "Hold the phone upright"
        : "Turn the phone sideways"
      : pose.tilt >= TILT_OK
        ? `Point the phone straight at the saree · ${Math.round(pose.tilt)}° off`
        : pose.roll >= ROLL_OK
          ? `Straighten the phone · ${Math.round(pose.roll)}° off`
          : !pose.still
            ? "Straight. Hold still"
            : "Straight and still";

  // The preview window: the photo's own shape, as large as the space allows.
  const topBar = 46 + insets.top;
  const bottomBar = 150 + insets.bottom;
  const liveH = winH - topBar - bottomBar;
  const viewW = Math.min(winW, (liveH * 3) / 4);
  const viewH = (viewW * 4) / 3;
  const viewX = (winW - viewW) / 2;
  const viewY = topBar + (liveH - viewH) / 2;

  /**
   * The full-resolution still. iOS names it "Photo" (4032 x 3024 on a 12 MP
   * camera) next to video-shaped presets like "3840x2160" — picking the
   * largest number there gave 16:9 frames (25 Sep, 1776 x 3840). Android
   * lists plain "WxH" sizes, where the largest area is the full still.
   */
  async function pickLargestSize() {
    try {
      const sizes = (await cameraRef.current?.getAvailablePictureSizesAsync()) ?? [];
      if (sizes.includes("Photo")) {
        setPictureSize("Photo");
        return;
      }
      const area = (name: string) => name.split("x").map(Number).reduce((a, b) => a * (b || 0), 1);
      const largest = sizes.filter((n) => /^\d+x\d+$/.test(n)).sort((a, b) => area(b) - area(a))[0];
      if (largest) setPictureSize(largest);
    } catch {
      // keep the camera's default
    }
  }

  function toggleWide() {
    const next = !wide;
    setWide(next);
    void SecureStore.setItemAsync(WIDE_KEY, next ? "1" : "0");
  }

  /** Wait up to a second and a half for the phone to settle, then shoot either way. */
  async function shoot() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      if (poseRef.current && !poseRef.current.still) {
        setWaiting(true);
        const until = Date.now() + 1500;
        while (Date.now() < until && poseRef.current && !poseRef.current.still) {
          await new Promise((r) => setTimeout(r, 100));
        }
        setWaiting(false);
      }
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (photo) setCaptured({ uri: photo.uri, width: photo.width, height: photo.height });
    } finally {
      setBusy(false);
      setWaiting(false);
    }
  }

  if (!permission) {
    return (
      <View style={[s.page, s.center]}>
        <ActivityIndicator color={C.accentStrong} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[s.page, s.center, { padding: 24, gap: 14 }]}>
        <Text style={s.permissionText}>Allow the camera to photograph the saree on the rod.</Text>
        <Pressable style={s.action} onPress={() => void requestPermission()}>
          <Text style={s.actionText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text style={s.link}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (captured && cropping) {
    return <CropView photo={captured} onDone={(p) => onCapture({ uri: p.uri, width: p.width, height: p.height })} onCancel={() => setCropping(false)} />;
  }

  if (captured) {
    return (
      <View style={s.page}>
        <Image source={{ uri: captured.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        <View style={s.reviewBar}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable style={[s.secondary, { flex: 1 }]} onPress={() => setCaptured(null)}>
              <Text style={s.secondaryText}>Retake</Text>
            </Pressable>
            <Pressable style={[s.secondary, { flex: 1 }]} onPress={() => setCropping(true)}>
              <Text style={s.secondaryText}>Crop</Text>
            </Pressable>
          </View>
          <Pressable style={s.action} onPress={() => onCapture(captured)}>
            <Text style={s.actionText}>Use photo</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const cornerColor = ready ? C.good : C.accentStrong;

  return (
    <View style={s.page}>
      {/* The preview, in a window shaped like the photo: what you see is what you get. */}
      <View style={{ position: "absolute", left: viewX, top: viewY, width: viewW, height: viewH, overflow: "hidden" }}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          flash="off"
          ratio="4:3"
          pictureSize={pictureSize}
          selectedLens={wide && ultraWide ? ultraWide : undefined}
          onAvailableLensesChanged={(e) => setLenses(e.lenses)}
          onCameraReady={() => void pickLargestSize()}
        />
      </View>

      {/* The window's corners: orange until the phone is straight and still, then green. */}
      <View pointerEvents="none" style={{ position: "absolute", left: viewX, top: viewY, width: viewW, height: viewH }}>
        <View style={[s.corner, s.cornerTL, { borderColor: cornerColor }]} />
        <View style={[s.corner, s.cornerTR, { borderColor: cornerColor }]} />
        <View style={[s.corner, s.cornerBL, { borderColor: cornerColor }]} />
        <View style={[s.corner, s.cornerBR, { borderColor: cornerColor }]} />
        {/* A centre cross that turns green with the corners. */}
        <View style={[s.crossH, { backgroundColor: cornerColor }]} />
        <View style={[s.crossV, { backgroundColor: cornerColor }]} />
      </View>

      <View style={[s.topBar, { height: topBar, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={s.closeX}>✕</Text>
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={s.shotLabel}>{shot.label}</Text>
          <View style={s.oriChip}>
            <View style={{ width: upright ? 7 : 11, height: upright ? 11 : 7, borderWidth: 1.5, borderColor: "#fff", borderRadius: 2 }} />
            <Text style={s.oriChipText}>{upright ? "Upright" : "Sideways"}</Text>
          </View>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={[s.bottomBar, { height: bottomBar, paddingBottom: insets.bottom }]}>
        <View style={[s.levelPill, ready ? s.levelOk : s.levelOff]}>
          <Text style={[s.levelText, { color: ready ? C.good : "#fff" }]}>{waiting ? "Hold still…" : hint}</Text>
        </View>
        <View style={s.shutterRow}>
          <View style={{ width: 64 }} />
          <Pressable style={[s.shutter, { borderColor: ready ? C.good : "rgba(255,255,255,0.4)" }, busy && { opacity: 0.5 }]} onPress={() => void shoot()} disabled={busy}>
            {busy ? <ActivityIndicator color="#000" /> : <View style={s.shutterInner} />}
          </Pressable>
          {ultraWide ? (
            <Pressable style={[s.lensBtn, wide && s.lensBtnOn]} onPress={toggleWide} hitSlop={8} accessibilityLabel={wide ? "Wide lens on" : "Wide lens off"}>
              <Text style={[s.lensText, wide && { color: "#000" }]}>{wide ? "0.5×" : "1×"}</Text>
            </Pressable>
          ) : (
            <View style={{ width: 64 }} />
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 30, height: 30 },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  crossH: { position: "absolute", left: "50%", top: "50%", width: 22, height: 2, marginLeft: -11, marginTop: -1, opacity: 0.8 },
  crossV: { position: "absolute", left: "50%", top: "50%", width: 2, height: 22, marginLeft: -1, marginTop: -11, opacity: 0.8 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  closeX: { color: "#fff", fontSize: 20, width: 24 },
  shotLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },
  oriChip: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.pill, backgroundColor: "rgba(255,255,255,0.16)" },
  oriChipText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", paddingTop: 12, gap: 12 },
  levelPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: R.pill, borderWidth: 1, maxWidth: "92%" },
  levelOk: { borderColor: "rgba(143,224,182,0.6)", backgroundColor: "rgba(143,224,182,0.14)" },
  levelOff: { borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(255,255,255,0.08)" },
  levelText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  shutterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 36 },
  shutter: { width: 74, height: 74, borderRadius: 37, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 4 },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff", borderWidth: 2, borderColor: "#000" },
  lensBtn: { width: 64, height: 40, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  lensBtnOn: { backgroundColor: C.accentPale, borderColor: C.accentPale },
  lensText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  reviewBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 40, gap: 10, backgroundColor: "rgba(0,0,0,0.55)" },
  action: { minHeight: 52, borderRadius: R.pill, backgroundColor: C.actionTop, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  actionText: { color: "#fff8f1", fontSize: 15, fontWeight: "600" },
  secondary: { minHeight: 48, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  permissionText: { color: C.text, fontSize: 15, textAlign: "center" },
  link: { color: C.accentPale, fontSize: 14, fontWeight: "600" },
});
