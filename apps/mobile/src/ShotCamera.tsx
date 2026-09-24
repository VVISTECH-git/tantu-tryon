import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Shot } from "@tantu/shared/shots";
import { C, R } from "./theme";

/**
 * Tantu's own camera, not the phone's.
 *
 * The phone's own camera app has no idea what a saree shot needs, so it
 * shows nothing but a shutter button. This one draws the same guide box
 * from the How sheet's diagram live on the preview — upright and tall for
 * body-family shots, wide for pallu-family ones — so the shooter lines the
 * fabric up before pressing the shutter instead of guessing and checking
 * afterwards. Corner brackets rather than a dashed border: React Native's
 * dashed border style is unreliable on Android.
 */

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

export function ShotCamera({ shot, onCapture, onClose }: { shot: Shot; onCapture: (photo: CapturedPhoto) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // The guide box: the same aspect ratio the tile itself frames photos to,
  // sized to fill nearly all of the live area between the top bar and the
  // shutter — a small guide box is worse than none, since it can't actually
  // show where the fabric's edges should land. This screen sits in a plain
  // Modal, outside App.tsx's SafeAreaView, so the bars add the real notch
  // and home-indicator insets themselves rather than guessing a number.
  const topBar = 46 + insets.top;
  const bottomBar = 120 + insets.bottom;
  const liveH = winH - topBar - bottomBar;
  const liveW = winW;
  const upright = shot.orientation === "upright";
  const targetRatio = upright ? 3 / 4 : 4 / 3; // width / height
  let guideW = liveW * (upright ? 0.94 : 0.98);
  let guideH = guideW / targetRatio;
  if (guideH > liveH * 0.99) {
    guideH = liveH * 0.99;
    guideW = guideH * targetRatio;
  }
  const guideX = (liveW - guideW) / 2;
  const guideY = topBar + (liveH - guideH) / 2;

  async function shoot() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (photo) setCaptured({ uri: photo.uri, width: photo.width, height: photo.height });
    } finally {
      setBusy(false);
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

  if (captured) {
    return (
      <View style={s.page}>
        <Image source={{ uri: captured.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={s.reviewBar}>
          <Pressable style={s.secondary} onPress={() => setCaptured(null)}>
            <Text style={s.secondaryText}>Retake</Text>
          </Pressable>
          <Pressable style={s.action} onPress={() => onCapture(captured)}>
            <Text style={s.actionText}>Use photo</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.page}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" flash="off" />

      {/* Dim everything outside the guide box, like a spotlight. */}
      <View pointerEvents="none" style={[s.mask, { top: topBar, height: guideY - topBar }]} />
      <View pointerEvents="none" style={[s.mask, { top: guideY + guideH, height: winH - bottomBar - (guideY + guideH) }]} />
      <View pointerEvents="none" style={[s.mask, { top: guideY, height: guideH, left: 0, width: guideX }]} />
      <View pointerEvents="none" style={[s.mask, { top: guideY, height: guideH, left: guideX + guideW, width: liveW - guideX - guideW }]} />

      {/* The guide box itself, with corner brackets. */}
      <View pointerEvents="none" style={{ position: "absolute", left: guideX, top: guideY, width: guideW, height: guideH }}>
        <View style={[s.corner, s.cornerTL]} />
        <View style={[s.corner, s.cornerTR]} />
        <View style={[s.corner, s.cornerBL]} />
        <View style={[s.corner, s.cornerBR]} />
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
        <Text style={s.whereText}>{shot.where}</Text>
        <Pressable style={[s.shutter, busy && { opacity: 0.5 }]} onPress={() => void shoot()} disabled={busy}>
          {busy ? <ActivityIndicator color="#000" /> : <View style={s.shutterInner} />}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center" },
  mask: { position: "absolute", left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)" },
  corner: { position: "absolute", width: 28, height: 28, borderColor: C.accentStrong },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
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
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", paddingTop: 14, gap: 14 },
  whereText: { color: "#fff", fontSize: 13, textAlign: "center", paddingHorizontal: 30, lineHeight: 18 },
  shutter: { width: 74, height: 74, borderRadius: 37, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "rgba(255,255,255,0.4)" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff", borderWidth: 2, borderColor: "#000" },
  reviewBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 40, gap: 10, backgroundColor: "rgba(0,0,0,0.55)" },
  action: { minHeight: 52, borderRadius: R.pill, backgroundColor: C.actionTop, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  actionText: { color: "#fff8f1", fontSize: 15, fontWeight: "600" },
  secondary: { minHeight: 48, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  permissionText: { color: C.text, fontSize: 15, textAlign: "center" },
  link: { color: C.accentPale, fontSize: 14, fontWeight: "600" },
});
