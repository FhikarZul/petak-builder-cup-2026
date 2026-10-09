import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { clampPan, clampZoom, zoomAround, fitImage } from '../lib/photoZoom';

/** A local gesture root also supports Android's separate Modal window. */
export function ZoomablePhoto({ uri }: { uri: string }) {
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);
  const fittedWidth = useSharedValue(0);
  const fittedHeight = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .onStart(event => {
      startScale.value = scale.value;
      startX.value = x.value;
      startY.value = y.value;
      focalX.value = event.focalX - width.value / 2;
      focalY.value = event.focalY - height.value / 2;
    })
    .onUpdate(event => {
      const next = clampZoom(startScale.value * event.scale);
      x.value = clampPan(zoomAround(startX.value, focalX.value, startScale.value, next), width.value, fittedWidth.value, next);
      y.value = clampPan(zoomAround(startY.value, focalY.value, startScale.value, next), height.value, fittedHeight.value, next);
      scale.value = next;
    });
  const pan = Gesture.Pan().maxPointers(1)
    .onStart(() => { panX.value = x.value; panY.value = y.value; })
    .onUpdate(event => {
      x.value = clampPan(panX.value + event.translationX, width.value, fittedWidth.value, scale.value);
      y.value = clampPan(panY.value + event.translationY, height.value, fittedHeight.value, scale.value);
    });
  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd((event, success) => {
    if (!success) return;
    const next = scale.value > 1 ? 1 : 2;
    x.value = clampPan(zoomAround(x.value, event.x - width.value / 2, scale.value, next), width.value, fittedWidth.value, next);
    y.value = clampPan(zoomAround(y.value, event.y - height.value / 2, scale.value, next), height.value, fittedHeight.value, next);
    scale.value = next;
  });
  const transform = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));
  // Refit when either layout or decoded image dimensions arrive, in either order.
  const updateFit = (viewportWidth: number, viewportHeight: number, intrinsicWidth: number, intrinsicHeight: number) => {
    const fitted = fitImage(viewportWidth, viewportHeight, intrinsicWidth, intrinsicHeight);
    fittedWidth.value = fitted.width;
    fittedHeight.value = fitted.height;
    x.value = clampPan(x.value, viewportWidth, fitted.width, scale.value);
    y.value = clampPan(y.value, viewportHeight, fitted.height, scale.value);
  };
  return (
    <GestureHandlerRootView style={{ flex: 1, width: '100%', overflow: 'hidden' }}
      onLayout={({ nativeEvent: { layout } }) => {
        width.value = layout.width;
        height.value = layout.height;
        updateFit(layout.width, layout.height, imageWidth.value, imageHeight.value);
      }}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, Gesture.Race(pan, doubleTap))}>
        <Reanimated.View style={{ flex: 1 }} collapsable={false}>
          <Reanimated.Image source={{ uri }} resizeMode="contain"
            onLoad={({ nativeEvent: { source } }) => {
              imageWidth.value = source.width;
              imageHeight.value = source.height;
              updateFit(width.value, height.value, source.width, source.height);
            }}
            accessibilityLabel="Photo. Pinch to zoom, drag to move, double tap to zoom or reset."
            style={[{ width: '100%', height: '100%' }, transform]} />
        </Reanimated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
