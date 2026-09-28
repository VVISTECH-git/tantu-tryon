import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, PanResponder, PixelRatio, Platform, ScrollView, Text, View, useWindowDimensions } from "react-native";

/**
 * The original at its real pixel size, to look at the weave (28 Sep). The
 * phone decodes a photo at the size it is laid out, so a fitted photo zoomed
 * in only ever shows screen-sized detail. Laid out here at one image pixel
 * per screen pixel, inside a scroll view that moves both ways, every pixel
 * the camera took is on screen. It opens centred.
 */
export function DetailImage({ uri }: { uri: string }) {
  const win = useWindowDimensions();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    Image.getSize(
      uri,
      (w, h) => live && setSize({ w: w / PixelRatio.get(), h: h / PixelRatio.get() }),
      () => live && setProblem("The full photo could not be loaded."),
    );
    return () => {
      live = false;
    };
  }, [uri]);
  if (problem) return <Text style={{ color: "#fff", textAlign: "center", marginTop: "60%" }}>{problem}</Text>;
  if (!size) return <ActivityIndicator color="#fff" style={{ flex: 1 }} />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentOffset={{ x: 0, y: Math.max(0, (size.h - win.height) / 2) }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          contentOffset={{ x: Math.max(0, (size.w - win.width) / 2), y: 0 }}
          showsHorizontalScrollIndicator={false}
        >
          <Image source={{ uri }} style={{ width: size.w, height: size.h }} onLoadEnd={() => setLoaded(true)} />
        </ScrollView>
      </ScrollView>
      {!loaded && (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "45%", alignItems: "center", gap: 10 }}>
          <ActivityIndicator color="#fff" />
          <Text style={{ color: "#fff" }}>Loading the full photo…</Text>
        </View>
      )}
    </View>
  );
}

/**
 * A photo shown whole, fitted to the screen, on every page. It opens fitted
 * and never zooms by itself (25 Sep: opening zoomed in on the weave was
 * confusing); a deliberate two-finger pinch still enlarges it.
 */
export function ZoomImage({ uri }: { uri: string }) {
  return Platform.OS === "ios" ? <IosZoom uri={uri} /> : <AndroidZoom uri={uri} />;
}

function IosZoom({ uri }: { uri: string }) {
  const win = useWindowDimensions();
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ width: win.width, height: win.height }}
      minimumZoomScale={1}
      maximumZoomScale={4}
      centerContent
      bouncesZoom
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    >
      <Image source={{ uri }} style={{ width: win.width, height: win.height }} resizeMode="contain" />
    </ScrollView>
  );
}

/** Android has no zooming scroll view: pinch and drag by hand. */
function AndroidZoom({ uri }: { uri: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const state = useRef({ s: 1, x: 0, y: 0, startDist: 0, startS: 1 }).current;

  const dist = (t: readonly { pageX: number; pageY: number }[]) =>
    Math.hypot(t[0]!.pageX - t[1]!.pageX, t[0]!.pageY - t[1]!.pageY);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        state.startDist = e.nativeEvent.touches.length === 2 ? dist(e.nativeEvent.touches) : 0;
        state.startS = state.s;
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          if (!state.startDist) {
            state.startDist = dist(touches);
            state.startS = state.s;
          }
          scale.setValue(Math.min(6, Math.max(1, (state.startS * dist(touches)) / state.startDist)));
        } else if (state.s > 1) {
          tx.setValue(state.x + g.dx);
          ty.setValue(state.y + g.dy);
        }
      },
      onPanResponderRelease: (_e, g) => {
        // @ts-expect-error Animated.Value keeps its current number here.
        state.s = scale.__getValue() as number;
        if (state.s > 1) {
          state.x += g.dx;
          state.y += g.dy;
        } else {
          state.x = 0;
          state.y = 0;
          tx.setValue(0);
          ty.setValue(0);
        }
        state.startDist = 0;
      },
    }),
  ).current;

  return (
    <View style={{ flex: 1, overflow: "hidden" }} {...responder.panHandlers}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: tx }, { translateY: ty }, { scale }] }}>
        <Image source={{ uri }} resizeMode="contain" style={{ flex: 1, width: "100%" }} />
      </Animated.View>
    </View>
  );
}
