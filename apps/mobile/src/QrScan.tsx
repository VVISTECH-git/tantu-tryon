import { CameraView, scanFromURLAsync, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { extractTextFromImage, isSupported as isTextReaderSupported } from "expo-text-extractor";
import { codeFromTagText } from "./tagCode";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, R } from "./theme";

/**
 * Reads a product tag: a QR code, or the barcode price tags usually carry.
 * The product ID is the code's text; when the code holds a link, its last
 * part. Uses the camera already in the app, so no new build is needed.
 *
 * iPhone (26 Sep): this camera's autofocus is off unless asked, and the main
 * lens cannot focus closer than about 15-20 cm, so a small QR on a tag read
 * as a blur. Autofocus is on, the view can zoom so the phone stays back, and
 * a photo taken with the phone's own camera (which does focus close) can be
 * read instead.
 */
function codeFrom(raw: string | undefined): string {
  const text = (raw ?? "").trim();
  return (/^https?:\/\//i.test(text) ? text.replace(/[/?#]+$/, "").split(/[/?#=]/).pop() : text) ?? "";
}

export function QrScan({ onCode, onCancel }: { onCode: (code: string) => void; onCancel: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [zoom, setZoom] = useState(0.02);
  const [reading, setReading] = useState(false);
  const done = useRef(false);
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const snapping = useRef(false);
  const [readingPrint, setReadingPrint] = useState(false);

  // Tags whose QR a phone cannot decode (26 Sep) still carry the code in
  // print: while no QR has been read, a silent still is taken every few
  // seconds and its printed code read on the phone.
  useEffect(() => {
    if (!permission?.granted || !isTextReaderSupported) return;
    const timer = setInterval(() => {
      if (done.current || snapping.current || !camera.current) return;
      snapping.current = true;
      setReadingPrint(true);
      void (async () => {
        try {
          const shot = await camera.current?.takePictureAsync({ quality: 0.7, shutterSound: false });
          if (!shot || done.current) return;
          const printed = codeFromTagText(await extractTextFromImage(shot.uri).catch(() => [] as string[]));
          if (printed) found(printed);
        } catch {
          // A still could not be taken this time; the next tick tries again.
        } finally {
          snapping.current = false;
          setReadingPrint(false);
        }
      })();
    }, 2500);
    return () => clearInterval(timer);
  }, [permission?.granted]);

  function found(raw: string | undefined): boolean {
    if (done.current) return true;
    const code = codeFrom(raw);
    if (!code) return false;
    done.current = true;
    onCode(code);
    return true;
  }

  async function fromPhoto(source: "camera" | "library") {
    setReading(true);
    try {
      const pick =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (pick.canceled || !pick.assets[0]) return;
      const uri = pick.assets[0].uri;
      const results = await scanFromURLAsync(uri, ["qr"]).catch(() => []);
      if (results.some((r) => found(r.data))) return;
      // The QR could not be read: read the code printed on the tag instead.
      const lines = isTextReaderSupported ? await extractTextFromImage(uri).catch(() => [] as string[]) : [];
      const printed = codeFromTagText(lines);
      if (printed && found(printed)) return;
      Alert.alert("No product code found", "Take the photo closer, so the tag's printed code is sharp and fills more of the picture.");
    } catch (problem) {
      Alert.alert("Could not read the photo", problem instanceof Error ? problem.message : "Try again.");
    } finally {
      setReading(false);
    }
  }

  if (!permission) return <View style={st.root} />;
  if (!permission.granted) {
    return (
      <View style={[st.root, st.centre]}>
        <Text style={st.copy}>Tantu needs the camera to read the product tag.</Text>
        <Pressable style={st.button} onPress={() => void requestPermission()}>
          <Text style={st.buttonText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={st.link}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        autofocus="on"
        zoom={zoom}
        barcodeScannerSettings={{ barcodeTypes: ["qr", "code128"] }}
        onBarcodeScanned={({ data }) => {
          found(data);
        }}
      />
      <View style={[st.bar, { paddingTop: insets.top + 12 }]}>
        <Text style={st.title}>Scan the product tag</Text>
        <Pressable onPress={onCancel} hitSlop={12} accessibilityLabel="Close">
          <Text style={st.close}>✕</Text>
        </Pressable>
      </View>
      <View style={st.centre} pointerEvents="none">
        <View style={st.window} />
        <Text style={st.hint}>Hold the phone about 20 cm away, with the QR code and the printed code in the box. Zoom in if they look small.</Text>
        {readingPrint && <Text style={st.status}>Reading the printed code…</Text>}
      </View>
      <View style={[st.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={st.zoomRow}>
          <Pressable style={st.zoomBtn} onPress={() => setZoom((z) => Math.max(0, +(z - 0.02).toFixed(2)))} accessibilityLabel="Zoom out">
            <Text style={st.zoomText}>−</Text>
          </Pressable>
          <Text style={st.zoomLabel}>Zoom</Text>
          <Pressable style={st.zoomBtn} onPress={() => setZoom((z) => Math.min(0.3, +(z + 0.02).toFixed(2)))} accessibilityLabel="Zoom in">
            <Text style={st.zoomText}>+</Text>
          </Pressable>
        </View>
        <Pressable style={st.button} disabled={reading} onPress={() => void fromPhoto("camera")}>
          <Text style={st.buttonText}>{reading ? "Reading…" : "Take a photo of the tag"}</Text>
        </Pressable>
        <Pressable disabled={reading} onPress={() => void fromPhoto("library")} hitSlop={10}>
          <Text style={st.link}>Read from gallery</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 24 },
  bar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.55)" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 2, alignItems: "center", gap: 14, paddingTop: 16, backgroundColor: "rgba(0,0,0,0.55)" },
  title: { color: "#fff", fontSize: 16, fontWeight: "600" },
  close: { color: "#fff", fontSize: 22, width: 28, textAlign: "center" },
  window: { width: 250, height: 250, borderRadius: R.lg, borderWidth: 3, borderColor: C.accentStrong },
  status: { color: C.accentStrong, fontSize: 14, fontWeight: "600", textShadowColor: "#000", textShadowRadius: 6 },
  hint: { color: "#fff", fontSize: 15, textAlign: "center", textShadowColor: "#000", textShadowRadius: 6, maxWidth: 300 },
  zoomRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  zoomBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", alignItems: "center", justifyContent: "center" },
  zoomText: { color: "#fff", fontSize: 26, lineHeight: 30 },
  zoomLabel: { color: "#fff", fontSize: 14 },
  copy: { color: C.text, fontSize: 16, textAlign: "center" },
  button: { backgroundColor: C.accentStrong, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { color: C.accent, fontSize: 15, textDecorationLine: "underline" },
});
