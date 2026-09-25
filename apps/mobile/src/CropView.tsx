import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, R } from "./theme";

/**
 * Crop a photo before it is saved.
 *
 * A saree on a rod comes with the room around it — the cupboard above, the
 * floor below, the end pooled on the ground. Dragging a corner, or the box
 * itself, keeps just the fabric. The crop is taken from the full-resolution
 * original and written at the highest JPEG quality; "Use full photo" sends
 * the original untouched.
 */

export interface Photo {
  uri: string;
  width: number;
  height: number;
  mimeType?: string;
}

type Box = { x: number; y: number; w: number; h: number };
type Grip = "tl" | "tr" | "bl" | "br" | "move";

const MIN = 60;
const HANDLE = 44;

export function CropView({ photo, onDone, onCancel }: { photo: Photo; onDone: (photo: Photo) => void; onCancel: () => void }) {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The size as displayed: RN applies the photo's orientation tag, so this
  // is the upright size the crop box is drawn over.
  useEffect(() => {
    Image.getSize(
      photo.uri,
      (w, h) => setSize({ w, h }),
      () => setSize({ w: photo.width, h: photo.height }),
    );
  }, [photo.uri, photo.width, photo.height]);

  const top = insets.top + 56;
  const bottom = insets.bottom + 150;
  // Kept well in from the screen's sides: a corner dragged at the very edge
  // would start Android's edge-swipe back gesture and close the crop.
  const SIDE = 40;
  const areaW = winW - SIDE * 2;
  const areaH = winH - top - bottom;
  const scale = size ? Math.min(areaW / size.w, areaH / size.h) : 1;
  const dispW = size ? size.w * scale : 0;
  const dispH = size ? size.h * scale : 0;
  const offX = SIDE + (areaW - dispW) / 2;
  const offY = top + (areaH - dispH) / 2;

  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const boxRef = useRef(box);
  boxRef.current = box;
  useEffect(() => {
    if (dispW && dispH) setBox({ x: 0, y: 0, w: dispW, h: dispH });
  }, [dispW, dispH]);

  const responders = useMemo(() => {
    const make = (grip: Grip) => {
      let start: Box = boxRef.current;
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start = boxRef.current;
        },
        onPanResponderMove: (_e, g) => {
          let { x, y, w, h } = start;
          if (grip === "move") {
            x = Math.min(Math.max(0, start.x + g.dx), dispW - w);
            y = Math.min(Math.max(0, start.y + g.dy), dispH - h);
          } else {
            const left = grip === "tl" || grip === "bl";
            const upper = grip === "tl" || grip === "tr";
            if (left) {
              const nx = Math.min(Math.max(0, start.x + g.dx), start.x + start.w - MIN);
              w = start.w + (start.x - nx);
              x = nx;
            } else {
              w = Math.min(Math.max(MIN, start.w + g.dx), dispW - start.x);
            }
            if (upper) {
              const ny = Math.min(Math.max(0, start.y + g.dy), start.y + start.h - MIN);
              h = start.h + (start.y - ny);
              y = ny;
            } else {
              h = Math.min(Math.max(MIN, start.h + g.dy), dispH - start.y);
            }
          }
          setBox({ x, y, w, h });
        },
      });
    };
    return { tl: make("tl"), tr: make("tr"), bl: make("bl"), br: make("br"), move: make("move") };
  }, [dispW, dispH]);

  const whole = box.x < 1 && box.y < 1 && Math.abs(box.w - dispW) < 1 && Math.abs(box.h - dispH) < 1;

  async function crop() {
    if (!size) return;
    if (whole) return onDone(photo);
    setBusy(true);
    setError(null);
    try {
      const originX = Math.round(box.x / scale);
      const originY = Math.round(box.y / scale);
      const width = Math.min(size.w - originX, Math.round(box.w / scale));
      const height = Math.min(size.h - originY, Math.round(box.h / scale));
      const context = ImageManipulator.manipulate(photo.uri);
      context.crop({ originX, originY, width, height });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ compress: 1, format: SaveFormat.JPEG });
      onDone({ uri: saved.uri, width: saved.width, height: saved.height, mimeType: "image/jpeg" });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not crop the photo.");
      setBusy(false);
    }
  }

  return (
    <View style={s.page}>
      {size ? (
        <>
          <Image source={{ uri: photo.uri }} style={{ position: "absolute", left: offX, top: offY, width: dispW, height: dispH }} resizeMode="stretch" />
          {/* Dim what the crop leaves out. */}
          <View pointerEvents="none" style={[s.mask, { left: offX, top: offY, width: dispW, height: box.y }]} />
          <View pointerEvents="none" style={[s.mask, { left: offX, top: offY + box.y + box.h, width: dispW, height: dispH - box.y - box.h }]} />
          <View pointerEvents="none" style={[s.mask, { left: offX, top: offY + box.y, width: box.x, height: box.h }]} />
          <View pointerEvents="none" style={[s.mask, { left: offX + box.x + box.w, top: offY + box.y, width: dispW - box.x - box.w, height: box.h }]} />
          {/* The box: drag inside to move it, a corner to size it. */}
          <View style={[s.box, { left: offX + box.x, top: offY + box.y, width: box.w, height: box.h }]} {...responders.move.panHandlers} />
          {(["tl", "tr", "bl", "br"] as const).map((grip) => (
            <View
              key={grip}
              {...responders[grip].panHandlers}
              style={[
                s.handle,
                {
                  left: offX + box.x + (grip === "tl" || grip === "bl" ? 0 : box.w) - HANDLE / 2,
                  top: offY + box.y + (grip === "tl" || grip === "tr" ? 0 : box.h) - HANDLE / 2,
                },
              ]}
            >
              <View style={[s.corner, grip === "tl" && s.cTL, grip === "tr" && s.cTR, grip === "bl" && s.cBL, grip === "br" && s.cBR]} />
            </View>
          ))}
        </>
      ) : (
        <ActivityIndicator color={C.accentStrong} style={{ marginTop: winH / 2 - 20 }} />
      )}

      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Crop the photo</Text>
        <Text style={s.hint}>Drag a corner to keep just the fabric</Text>
      </View>

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {error && <Text style={s.error}>{error}</Text>}
        <Pressable style={[s.action, busy && { opacity: 0.6 }]} disabled={busy || !size} onPress={() => void crop()}>
          {busy ? <ActivityIndicator color="#fff8f1" /> : <Text style={s.actionText}>{whole ? "Use full photo" : "Crop & use"}</Text>}
        </Pressable>
        <View style={s.row}>
          <Pressable style={[s.secondary, { flex: 1 }]} disabled={busy} onPress={onCancel}>
            <Text style={s.secondaryText}>Cancel</Text>
          </Pressable>
          {!whole && (
            <Pressable style={[s.secondary, { flex: 1 }]} disabled={busy} onPress={() => setBox({ x: 0, y: 0, w: dispW, h: dispH })}>
              <Text style={s.secondaryText}>Reset</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000" },
  mask: { position: "absolute", backgroundColor: "rgba(0,0,0,0.6)" },
  box: { position: "absolute", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)" },
  handle: { position: "absolute", width: HANDLE, height: HANDLE },
  corner: { position: "absolute", width: 22, height: 22, borderColor: C.accentStrong },
  cTL: { left: HANDLE / 2 - 2, top: HANDLE / 2 - 2, borderTopWidth: 4, borderLeftWidth: 4 },
  cTR: { right: HANDLE / 2 - 2, top: HANDLE / 2 - 2, borderTopWidth: 4, borderRightWidth: 4 },
  cBL: { left: HANDLE / 2 - 2, bottom: HANDLE / 2 - 2, borderBottomWidth: 4, borderLeftWidth: 4 },
  cBR: { right: HANDLE / 2 - 2, bottom: HANDLE / 2 - 2, borderBottomWidth: 4, borderRightWidth: 4 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingBottom: 10, backgroundColor: "rgba(0,0,0,0.55)" },
  title: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 3 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, gap: 10, backgroundColor: "rgba(0,0,0,0.55)" },
  row: { flexDirection: "row", gap: 10 },
  action: { minHeight: 52, borderRadius: R.pill, backgroundColor: C.actionTop, alignItems: "center", justifyContent: "center" },
  actionText: { color: "#fff8f1", fontSize: 15, fontWeight: "600" },
  secondary: { minHeight: 46, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  error: { color: "#ffb3ad", fontSize: 13, textAlign: "center" },
});
