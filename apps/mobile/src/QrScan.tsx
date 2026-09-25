import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, R } from "./theme";

/**
 * Reads a product tag: a QR code, or the barcodes price tags usually carry.
 * The product ID is the code's text; when the code holds a link, its last
 * part. Uses the camera already in the app, so no new build is needed.
 */
export function QrScan({ onCode, onCancel }: { onCode: (code: string) => void; onCancel: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);
  const insets = useSafeAreaInsets();

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
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39", "ean13", "ean8", "upc_a", "datamatrix"] }}
        onBarcodeScanned={({ data }) => {
          if (done.current) return;
          const text = (data ?? "").trim();
          const code = (/^https?:\/\//i.test(text) ? text.replace(/[/?#]+$/, "").split(/[/?#=]/).pop() : text) ?? "";
          if (!code) return;
          done.current = true;
          onCode(code);
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
        <Text style={st.hint}>Hold the QR code or barcode inside the box</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 24 },
  bar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.55)" },
  title: { color: "#fff", fontSize: 16, fontWeight: "600" },
  close: { color: "#fff", fontSize: 22, width: 28, textAlign: "center" },
  window: { width: 250, height: 250, borderRadius: R.lg, borderWidth: 3, borderColor: C.accentStrong },
  hint: { color: "#fff", fontSize: 15, textAlign: "center", textShadowColor: "#000", textShadowRadius: 6 },
  copy: { color: C.text, fontSize: 16, textAlign: "center" },
  button: { backgroundColor: C.accentStrong, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { color: C.accent, fontSize: 15, textDecorationLine: "underline" },
});
