import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MAX_ANGLE, MAX_BRIGHTNESS, cleanEdit, editRect, type PhotoEdit } from "@tantu/shared/photoEdit";
import * as api from "./api";
import { C, R } from "./theme";

/**
 * The edit screen after every shot and upload (28 Sep).
 *
 * It opens with the box already round the saree (the free finder on the
 * server: the pink wall, the ceiling and the floor left out), so one tap on
 * Use keeps just the fabric. Crop, a quarter turn, straighten and a light
 * brightness change; no filters, which would change the saree's colour.
 *
 * What this screen shows is what is saved: the upload queue burns the edit
 * into the photo at full resolution and the highest JPEG quality (crop,
 * turns, straighten on the phone; brightness on the server, the phone having
 * no tool for it). This screen works on a small copy so every change shows at
 * once; brightness is shown here as a veil.
 */

export interface Photo {
  uri: string;
  width: number;
  height: number;
  mimeType?: string;
}

export interface Edited {
  /** The photo as taken, with its upright size; the edit is burned in before it is sent. */
  photo: Photo;
  edit: PhotoEdit | null;
  /** A small copy with the crop and turns, for showing on the phone straight away. */
  shownUri: string;
}

type Box = { x: number; y: number; w: number; h: number };
type Grip = "tl" | "tr" | "bl" | "br" | "move";
type Tool = "crop" | "straighten" | "light";

const MIN = 60;
const HANDLE = 44;
const WORK_EDGE = 1200;

export function EditView({ photo, onDone, onBack, backLabel }: { photo: Photo; onDone: (out: Edited) => void; onBack: () => void; backLabel: string }) {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [upright, setUpright] = useState<{ w: number; h: number } | null>(null);
  const [work, setWork] = useState<{ uri: string; w: number; h: number } | null>(null);
  const [view, setView] = useState<{ uri: string; w: number; h: number } | null>(null);
  const [quarter, setQuarter] = useState<0 | 90 | 180 | 270>(0);
  const [angle, setAngle] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [tool, setTool] = useState<Tool>("crop");
  const [finding, setFinding] = useState(true);
  const [found, setFound] = useState<Box | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The upright size (the phone applies the orientation tag when showing it), and a small working copy.
  useEffect(() => {
    let live = true;
    Image.getSize(
      photo.uri,
      (w, h) => live && setUpright({ w, h }),
      () => live && setUpright({ w: photo.width, h: photo.height }),
    );
    void (async () => {
      try {
        const context = ImageManipulator.manipulate(photo.uri);
        context.resize(photo.width >= photo.height ? { width: Math.min(WORK_EDGE, photo.width) } : { height: Math.min(WORK_EDGE, photo.height) });
        const saved = await (await context.renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
        if (live) setWork({ uri: saved.uri, w: saved.width, h: saved.height });
      } catch {
        if (live) setWork({ uri: photo.uri, w: photo.width, h: photo.height });
      }
    })();
    void api.detectFabric(photo.uri).then((b) => {
      if (!live) return;
      setFound(b);
      setFinding(false);
    });
    return () => {
      live = false;
    };
  }, [photo.uri, photo.width, photo.height]);

  // What is shown: the working copy turned and straightened, cut to its largest level rectangle.
  useEffect(() => {
    if (!work) return;
    if (!quarter && !angle) {
      setView(work);
      return;
    }
    let live = true;
    void (async () => {
      try {
        const { canvas, cut } = editRect(work.w, work.h, { quarter, angle });
        const context = ImageManipulator.manipulate(work.uri);
        context.rotate(quarter + angle);
        const turned = await context.renderAsync();
        // The phone's canvas can differ from the arithmetic by a pixel or two.
        const sx = turned.width / canvas.width;
        const sy = turned.height / canvas.height;
        const inner = ImageManipulator.manipulate((await turned.saveAsync({ compress: 0.9, format: SaveFormat.JPEG })).uri);
        const originX = Math.max(0, Math.round(cut.left * sx));
        const originY = Math.max(0, Math.round(cut.top * sy));
        inner.crop({ originX, originY, width: Math.min(turned.width - originX, Math.round(cut.width * sx)), height: Math.min(turned.height - originY, Math.round(cut.height * sy)) });
        const saved = await (await inner.renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
        if (live) setView({ uri: saved.uri, w: saved.width, h: saved.height });
      } catch (problem) {
        if (live) setError(problem instanceof Error ? problem.message : "Could not turn the photo.");
      }
    })();
    return () => {
      live = false;
    };
  }, [work, quarter, angle]);

  const top = insets.top + 56;
  const bottom = insets.bottom + 230;
  // Kept in from the sides: a corner dragged at the very edge would start Android's back gesture.
  const SIDE = 36;
  const areaW = winW - SIDE * 2;
  const areaH = winH - top - bottom;
  const scale = view ? Math.min(areaW / view.w, areaH / view.h) : 1;
  const dispW = view ? view.w * scale : 0;
  const dispH = view ? view.h * scale : 0;
  const offX = SIDE + (areaW - dispW) / 2;
  const offY = top + (areaH - dispH) / 2;

  // The crop, kept in fractions so it survives straightening; a quarter turn starts it afresh.
  const [crop, setCrop] = useState<Box>({ x: 0, y: 0, w: 1, h: 1 });
  const cropRef = useRef(crop);
  cropRef.current = crop;
  useEffect(() => {
    if (found) setCrop(found);
  }, [found]);
  const box: Box = { x: crop.x * dispW, y: crop.y * dispH, w: crop.w * dispW, h: crop.h * dispH };

  const responders = useMemo(() => {
    const make = (grip: Grip) => {
      let start: Box = cropRef.current;
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start = cropRef.current;
        },
        onPanResponderMove: (_e, g) => {
          if (!dispW || !dispH) return;
          const minW = MIN / dispW;
          const minH = MIN / dispH;
          const dx = g.dx / dispW;
          const dy = g.dy / dispH;
          let { x, y, w, h } = start;
          if (grip === "move") {
            x = Math.min(Math.max(0, start.x + dx), 1 - w);
            y = Math.min(Math.max(0, start.y + dy), 1 - h);
          } else {
            if (grip === "tl" || grip === "bl") {
              const nx = Math.min(Math.max(0, start.x + dx), start.x + start.w - minW);
              w = start.w + (start.x - nx);
              x = nx;
            } else {
              w = Math.min(Math.max(minW, start.w + dx), 1 - start.x);
            }
            if (grip === "tl" || grip === "tr") {
              const ny = Math.min(Math.max(0, start.y + dy), start.y + start.h - minH);
              h = start.h + (start.y - ny);
              y = ny;
            } else {
              h = Math.min(Math.max(minH, start.h + dy), 1 - start.y);
            }
          }
          setCrop({ x, y, w, h });
        },
      });
    };
    return { tl: make("tl"), tr: make("tr"), bl: make("bl"), br: make("br"), move: make("move") };
  }, [dispW, dispH]);

  const whole = crop.x < 0.005 && crop.y < 0.005 && crop.w > 0.99 && crop.h > 0.99;
  const changed = !whole || quarter !== 0 || angle !== 0 || brightness !== 0;

  function turn() {
    setQuarter((q) => (((q + 90) % 360) as 0 | 90 | 180 | 270));
    setCrop({ x: 0, y: 0, w: 1, h: 1 });
  }

  function reset() {
    setQuarter(0);
    setAngle(0);
    setBrightness(0);
    setCrop(found ?? { x: 0, y: 0, w: 1, h: 1 });
  }

  async function use() {
    if (!view || !upright) return;
    setBusy(true);
    setError(null);
    try {
      const edit = cleanEdit({ quarter, angle, brightness, crop: whole ? undefined : crop });
      // The phone's own small copy, cut as chosen, to show at once while the original sends.
      let shownUri = view.uri;
      if (!whole) {
        const context = ImageManipulator.manipulate(view.uri);
        const originX = Math.round(crop.x * view.w);
        const originY = Math.round(crop.y * view.h);
        context.crop({ originX, originY, width: Math.min(view.w - originX, Math.round(crop.w * view.w)), height: Math.min(view.h - originY, Math.round(crop.h * view.h)) });
        shownUri = (await (await context.renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG })).uri;
      }
      onDone({ photo: { ...photo, width: upright.w, height: upright.h }, edit, shownUri });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not finish the edit.");
      setBusy(false);
    }
  }

  const veil = brightness > 0 ? `rgba(255,255,255,${(brightness * 0.9).toFixed(3)})` : `rgba(0,0,0,${(-brightness * 1.2).toFixed(3)})`;

  return (
    <View style={s.page}>
      {view ? (
        <>
          <Image source={{ uri: view.uri }} style={{ position: "absolute", left: offX, top: offY, width: dispW, height: dispH }} resizeMode="stretch" />
          {brightness !== 0 && <View pointerEvents="none" style={{ position: "absolute", left: offX, top: offY, width: dispW, height: dispH, backgroundColor: veil }} />}
          {/* Dim what the crop leaves out. */}
          <View pointerEvents="none" style={[s.mask, { left: offX, top: offY, width: dispW, height: box.y }]} />
          <View pointerEvents="none" style={[s.mask, { left: offX, top: offY + box.y + box.h, width: dispW, height: dispH - box.y - box.h }]} />
          <View pointerEvents="none" style={[s.mask, { left: offX, top: offY + box.y, width: box.x, height: box.h }]} />
          <View pointerEvents="none" style={[s.mask, { left: offX + box.x + box.w, top: offY + box.y, width: dispW - box.x - box.w, height: box.h }]} />
          <View style={[s.box, { left: offX + box.x, top: offY + box.y, width: box.w, height: box.h }]} {...responders.move.panHandlers}>
            {tool === "straighten" && (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {[1, 2].map((i) => (
                  <View key={`h${i}`} style={[s.gridH, { top: `${(i * 100) / 3}%` }]} />
                ))}
                {[1, 2].map((i) => (
                  <View key={`v${i}`} style={[s.gridV, { left: `${(i * 100) / 3}%` }]} />
                ))}
              </View>
            )}
          </View>
          {(["tl", "tr", "bl", "br"] as const).map((grip) => (
            <View
              key={grip}
              {...responders[grip].panHandlers}
              style={[s.handle, { left: offX + box.x + (grip === "tl" || grip === "bl" ? 0 : box.w) - HANDLE / 2, top: offY + box.y + (grip === "tl" || grip === "tr" ? 0 : box.h) - HANDLE / 2 }]}
            >
              <View style={[s.corner, grip === "tl" && s.cTL, grip === "tr" && s.cTR, grip === "bl" && s.cBL, grip === "br" && s.cBR]} />
            </View>
          ))}
        </>
      ) : (
        <ActivityIndicator color={C.accentStrong} style={{ marginTop: winH / 2 - 20 }} />
      )}

      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Edit the photo</Text>
        <Text style={s.hint}>
          {finding ? "Finding the saree…" : found ? "Box set around the saree. Use, or adjust first." : "Drag a corner to keep just the fabric."}
        </Text>
      </View>

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        {tool === "straighten" && <Slider label="Straighten" value={angle} min={-MAX_ANGLE} max={MAX_ANGLE} step={0.5} unit="°" onChange={setAngle} />}
        {tool === "light" && (
          <Slider label="Brightness" value={Math.round(brightness * 100)} min={-MAX_BRIGHTNESS * 100} max={MAX_BRIGHTNESS * 100} step={1} unit="%" onChange={(v) => setBrightness(v / 100)} />
        )}
        <View style={s.tools}>
          <ToolButton label="Crop" on={tool === "crop"} onPress={() => setTool("crop")} />
          <ToolButton label="Rotate" onPress={turn} />
          <ToolButton label="Straighten" on={tool === "straighten"} onPress={() => setTool(tool === "straighten" ? "crop" : "straighten")} />
          <ToolButton label="Brightness" on={tool === "light"} onPress={() => setTool(tool === "light" ? "crop" : "light")} />
          <ToolButton label="Reset" onPress={reset} />
        </View>
        {error && <Text style={s.error}>{error}</Text>}
        <View style={s.row}>
          <Pressable style={[s.secondary, { flex: 1 }]} disabled={busy} onPress={onBack}>
            <Text style={s.secondaryText}>{backLabel}</Text>
          </Pressable>
          {!whole && (
            <Pressable style={[s.secondary, { flex: 1 }]} disabled={busy} onPress={() => setCrop({ x: 0, y: 0, w: 1, h: 1 })}>
              <Text style={s.secondaryText}>Full photo</Text>
            </Pressable>
          )}
        </View>
        <Pressable style={[s.action, busy && { opacity: 0.6 }]} disabled={busy || !view || !upright} onPress={() => void use()}>
          {busy ? <ActivityIndicator color="#fff8f1" /> : <Text style={s.actionText}>{changed ? "Use" : "Use photo"}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function ToolButton({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.tool, on && s.toolOn]} onPress={onPress} hitSlop={4}>
      <Text style={[s.toolText, on && { color: C.accentStrong }]}>{label}</Text>
    </Pressable>
  );
}

/** A plain slider: drag along the track, or tap −/+. No new native module needed. */
function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  const [width, setWidth] = useState(0);
  const startRef = useRef(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  const snap = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = valueRef.current;
        },
        onPanResponderMove: (_e, g) => {
          if (width) onChange(snap(startRef.current + (g.dx / width) * (max - min)));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, min, max, step],
  );
  const at = width ? ((value - min) / (max - min)) * width : 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={[s.row, { justifyContent: "space-between", alignItems: "center" }]}>
        <Pressable onPress={() => onChange(snap(value - step))} hitSlop={10}>
          <Text style={s.stepText}>−</Text>
        </Pressable>
        <Text style={s.sliderLabel}>
          {label} {value > 0 ? "+" : ""}
          {step < 1 ? value.toFixed(1) : value}
          {unit}
        </Text>
        <Pressable onPress={() => onChange(snap(value + step))} hitSlop={10}>
          <Text style={s.stepText}>+</Text>
        </Pressable>
      </View>
      <View style={s.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...responder.panHandlers}>
        <View style={s.trackLine} />
        <View style={[s.trackMid, { left: width / 2 }]} />
        <View style={[s.knob, { left: at - 12 }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000" },
  mask: { position: "absolute", backgroundColor: "rgba(0,0,0,0.6)" },
  box: { position: "absolute", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)" },
  gridH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.45)" },
  gridV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.45)" },
  handle: { position: "absolute", width: HANDLE, height: HANDLE },
  corner: { position: "absolute", width: 22, height: 22, borderColor: C.accentStrong },
  cTL: { left: HANDLE / 2 - 2, top: HANDLE / 2 - 2, borderTopWidth: 4, borderLeftWidth: 4 },
  cTR: { right: HANDLE / 2 - 2, top: HANDLE / 2 - 2, borderTopWidth: 4, borderRightWidth: 4 },
  cBL: { left: HANDLE / 2 - 2, bottom: HANDLE / 2 - 2, borderBottomWidth: 4, borderLeftWidth: 4 },
  cBR: { right: HANDLE / 2 - 2, bottom: HANDLE / 2 - 2, borderBottomWidth: 4, borderRightWidth: 4 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingBottom: 10, backgroundColor: "rgba(0,0,0,0.55)" },
  title: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 3, textAlign: "center", paddingHorizontal: 16 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, gap: 10, backgroundColor: "rgba(0,0,0,0.7)" },
  tools: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  tool: { flex: 1, minHeight: 38, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  toolOn: { borderColor: C.accentStrong, backgroundColor: "rgba(240,141,66,0.14)" },
  toolText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  row: { flexDirection: "row", gap: 10 },
  action: { minHeight: 52, borderRadius: R.pill, backgroundColor: C.actionTop, alignItems: "center", justifyContent: "center" },
  actionText: { color: "#fff8f1", fontSize: 15, fontWeight: "600" },
  secondary: { minHeight: 44, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  error: { color: "#ffb3ad", fontSize: 13, textAlign: "center" },
  sliderLabel: { color: "#fff", fontSize: 13, fontWeight: "600" },
  stepText: { color: "#fff", fontSize: 24, width: 36, textAlign: "center" },
  track: { height: 32, justifyContent: "center" },
  trackLine: { position: "absolute", left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" },
  trackMid: { position: "absolute", width: 2, height: 14, backgroundColor: "rgba(255,255,255,0.5)" },
  knob: { position: "absolute", width: 24, height: 24, borderRadius: 12, backgroundColor: C.accentStrong, borderWidth: 2, borderColor: "#fff" },
});
