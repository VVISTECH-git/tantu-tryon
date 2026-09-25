import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";

/**
 * A photo you can pinch and double-tap to look at the weave.
 *
 * iPhone decodes an image at the size it is laid out, so a 3024 px photo
 * shown at screen width is shrunk once and zooming only enlarges the blur.
 * Here the image is laid out at its own pixel size and the scroll view
 * starts zoomed out to fit: pinching in reaches the photo's real pixels.
 */
export function ZoomImage({ uri }: { uri: string }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let live = true;
    Image.getSize(
      uri,
      (w, h) => live && setSize({ w, h }),
      () => live && setSize({ w: 1000, h: 1333 }),
    );
    return () => {
      live = false;
    };
  }, [uri]);
  if (!size) return <ActivityIndicator color="#fff" style={{ flex: 1 }} />;
  return Platform.OS === "ios" ? <IosZoom uri={uri} size={size} /> : <AndroidZoom uri={uri} />;
}

function IosZoom({ uri, size }: { uri: string; size: { w: number; h: number } }) {
  const win = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  // Laid out at one image pixel per device pixel.
  const w = size.w / PixelRatio.get();
  const h = size.h / PixelRatio.get();
  const fit = Math.min(win.width / w, win.height / h, 1);
  const zoom = useRef(fit);
  const lastTap = useRef(0);

  function zoomAround(x: number, y: number, scale: number) {
    const rw = win.width / scale;
    const rh = win.height / scale;
    scroll.current?.scrollResponderZoomTo({ x: x - rw / 2, y: y - rh / 2, width: rw, height: rh, animated: true });
  }

  return (
    <ScrollView
      ref={scroll}
      style={{ flex: 1 }}
      contentContainerStyle={{ width: w, height: h }}
      minimumZoomScale={fit}
      maximumZoomScale={Math.max(fit, 3)}
      zoomScale={fit}
      centerContent
      bouncesZoom
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(e) => {
        zoom.current = e.nativeEvent.zoomScale;
      }}
    >
      <Pressable
        onPress={(e) => {
          const now = Date.now();
          if (now - lastTap.current < 300) {
            const { locationX, locationY } = e.nativeEvent;
            // Double tap: in to the photo's own pixels, or back out to fit.
            if (zoom.current > fit * 1.2) zoomAround(w / 2, h / 2, fit);
            else zoomAround(locationX, locationY, 1);
            lastTap.current = 0;
          } else lastTap.current = now;
        }}
      >
        <Image source={{ uri }} style={{ width: w, height: h }} resizeMode="contain" />
      </Pressable>
    </ScrollView>
  );
}

/** Android has no zooming scroll view: pinch and drag by hand. */
function AndroidZoom({ uri }: { uri: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const state = useRef({ s: 1, x: 0, y: 0, startDist: 0, startS: 1, lastTap: 0 }).current;

  const dist = (t: readonly { pageX: number; pageY: number }[]) =>
    Math.hypot(t[0]!.pageX - t[1]!.pageX, t[0]!.pageY - t[1]!.pageY);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const now = Date.now();
        if (now - state.lastTap < 300) {
          state.s = state.s > 1.2 ? 1 : 3;
          state.x = 0;
          state.y = 0;
          Animated.parallel([
            Animated.spring(scale, { toValue: state.s, useNativeDriver: true }),
            Animated.spring(tx, { toValue: 0, useNativeDriver: true }),
            Animated.spring(ty, { toValue: 0, useNativeDriver: true }),
          ]).start();
          state.lastTap = 0;
        } else state.lastTap = now;
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
