import React from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { theme } from '@/src/theme';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
  trackColor?: string;
  fillColor?: string;
  thumbColor?: string;
  thumbSize?: number;
  trackHeight?: number;
  disabled?: boolean;
  testID?: string;
  style?: any;
}

export function Slider({
  value = 0,
  min = 0,
  max = 1,
  step = 0,
  onValueChange,
  onSlidingStart,
  onSlidingComplete,
  trackColor,
  fillColor,
  thumbColor,
  thumbSize = 16,
  trackHeight = 4,
  disabled = false,
  testID,
  style,
}: SliderProps) {
  const trackWidth = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragRatio = useSharedValue(0);

  const ratioToValue = (ratio: number) => {
    let next = min + ratio * (max - min);
    if (step > 0) next = Math.round(next / step) * step;
    return Math.max(min, Math.min(max, next));
  };

  const commitChange = (ratio: number) => onValueChange(ratioToValue(ratio));
  const commitComplete = (ratio: number) => onSlidingComplete?.(ratioToValue(ratio));

  const pan = Gesture.Pan()
    .enabled(!disabled && !!onValueChange)
    .onBegin((e) => {
      if (trackWidth.value === 0) return;
      dragging.value = true;
      dragRatio.value = Math.max(0, Math.min(1, e.x / trackWidth.value));
      if (onSlidingStart) runOnJS(onSlidingStart)();
      runOnJS(commitChange)(dragRatio.value);
    })
    .onUpdate((e) => {
      if (trackWidth.value === 0) return;
      dragRatio.value = Math.max(0, Math.min(1, e.x / trackWidth.value));
      runOnJS(commitChange)(dragRatio.value);
    })
    .onFinalize(() => {
      dragging.value = false;
      runOnJS(commitComplete)(dragRatio.value);
    });

  const clampedValue = Math.max(min, Math.min(max, value));
  const propRatio = (clampedValue - min) / (max - min);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${(dragging.value ? dragRatio.value : propRatio) * 100}%`,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    left: `${(dragging.value ? dragRatio.value : propRatio) * 100}%`,
    transform: [{ translateX: -thumbSize / 2 }, { scale: dragging.value ? 1.3 : 1 }],
  }));

  return (
    <View
      testID={testID}
      style={[styles.container, { height: thumbSize }, style]}
      onLayout={(e: LayoutChangeEvent) => (trackWidth.value = e.nativeEvent.layout.width)}
    >
      <GestureDetector gesture={pan}>
        <View
          style={[styles.trackWrapper, { height: trackHeight, top: (thumbSize - trackHeight) / 2 }]}
          hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
        >
          <View
            style={[styles.track, { backgroundColor: trackColor || theme.colors.secondary, height: trackHeight }]}
          >
            <Animated.View
              style={[styles.fill, { backgroundColor: fillColor || theme.colors.accent, height: trackHeight }, fillStyle]}
            />
          </View>
          <Animated.View
            style={[
              styles.thumb,
              { width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, backgroundColor: thumbColor || theme.colors.accent },
              disabled && styles.thumbDisabled,
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  trackWrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  track: { borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  thumb: {
    position: 'absolute',
    top: 0,
    ...theme.shadows.sharp,
  },
  thumbDisabled: { opacity: theme.opacity.disabled },
});
