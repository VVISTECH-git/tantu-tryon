import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EditView, type Edited, type Photo } from "./EditView";
import { C, R } from "./theme";

/**
 * The photo just taken (or picked), before it is saved (28 Sep): Use photo is
 * the quick default, so the photographer shoots and moves on; Edit opens the
 * editor for a tilt, a dark photo or a crop. What Use saves is what is shown.
 */
export function PhotoReview({ photo, backLabel, onBack, onDone }: { photo: Photo; backLabel: string; onBack: () => void; onDone: (out: Edited | { photo: Photo; edit: null; shownUri?: undefined }) => void }) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  if (editing) return <EditView photo={photo} backLabel="Back" onBack={() => setEditing(false)} onDone={onDone} />;
  return (
    <View style={s.page}>
      <Image source={{ uri: photo.uri }} style={[StyleSheet.absoluteFill, { top: insets.top + 8, bottom: insets.bottom + 150 }]} resizeMode="contain" />
      <View style={[s.bar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.row}>
          <Pressable style={[s.secondary, { flex: 1 }]} onPress={onBack}>
            <Text style={s.secondaryText} allowFontScaling={false}>
              {backLabel}
            </Text>
          </Pressable>
          <Pressable style={[s.secondary, { flex: 1 }]} onPress={() => setEditing(true)}>
            <Text style={s.secondaryText} allowFontScaling={false}>
              Edit
            </Text>
          </Pressable>
        </View>
        <Pressable style={s.action} onPress={() => onDone({ photo, edit: null })}>
          <Text style={s.actionText} allowFontScaling={false}>
            Use photo
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000" },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, gap: 10, backgroundColor: "rgba(0,0,0,0.7)" },
  row: { flexDirection: "row", gap: 10 },
  action: { minHeight: 52, borderRadius: R.pill, backgroundColor: C.actionTop, alignItems: "center", justifyContent: "center" },
  actionText: { color: "#fff8f1", fontSize: 16, fontWeight: "600" },
  secondary: { minHeight: 46, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#fff", fontSize: 15, fontWeight: "500" },
});
