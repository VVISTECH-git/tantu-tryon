import { useRef, type ReactNode } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { C } from "./theme";

const OPEN = -84;

/**
 * A list row that slides left to show a delete button, like the phone's own
 * Messages list (28 Sep). Built on React Native's own touch handling, so it
 * ships as an app update without a new build. Only a sideways drag moves it;
 * an up-down drag still scrolls the list.
 */
export function SwipeRow({ children, onDelete, enabled = true }: { children: ReactNode; onDelete: () => void; enabled?: boolean }) {
  const x = useRef(new Animated.Value(0)).current;
  const at = useRef(0);
  const settle = (to: number) => {
    at.current = to;
    Animated.spring(x, { toValue: to, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  };
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => x.setValue(Math.min(0, Math.max(OPEN * 1.3, at.current + g.dx))),
      onPanResponderRelease: (_e, g) => settle(at.current + g.dx < OPEN / 2 ? OPEN : 0),
      onPanResponderTerminate: () => settle(at.current),
    }),
  ).current;

  if (!enabled) return <>{children}</>;
  return (
    <View>
      <View style={st.behind}>
        <Pressable
          style={st.bin}
          accessibilityLabel="Delete"
          onPress={() => {
            settle(0);
            onDelete();
          }}
        >
          <Text style={st.binText}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View style={[st.front, { transform: [{ translateX: x }] }]} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  behind: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "flex-end", justifyContent: "center", paddingRight: 4 },
  // The rows are see-through; solid underneath so the button stays hidden until slid.
  front: { backgroundColor: C.page, borderRadius: 16 },
  bin: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#e5484d", alignItems: "center", justifyContent: "center" },
  binText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
