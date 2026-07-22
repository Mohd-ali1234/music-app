import React from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { theme } from '@/src/theme';

export interface ProgressBarProps {
  progress: number;
  onSeek?: (progress: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  showKnob?: boolean;
  trackColor?: string;
  fillColor?: string;
  knobColor?: string;
  height?: number;
  testID?: string;
  style?: any;
}

export function ProgressBar({
  progress = 0,
  onSeek,
  onSeekStart,
  onSeekEnd,
  showKnob = true,
  trackColor,
  fillColor,
  knobColor,
  height = 4,
  testID,
  style,
}: ProgressBarProps) {
  const trackWidth = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragRatio = useSharedValue(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
  };

  const commitSeek = (ratio: number) => onSeek?.(ratio);

  const pan = Gesture.Pan()
    .enabled(!!onSeek)
    .onBegin((e) => {
      if (trackWidth.value === 0) return;
      dragging.value = true;
      dragRatio.value = Math.max(0, Math.min(1, e.x / trackWidth.value));
      if (onSeekStart) runOnJS(onSeekStart)();
      runOnJS(commitSeek)(dragRatio.value);
    })
    .onUpdate((e) => {
      if (trackWidth.value === 0) return;
      dragRatio.value = Math.max(0, Math.min(1, e.x / trackWidth.value));
      runOnJS(commitSeek)(dragRatio.value);
    })
    .onFinalize(() => {
      dragging.value = false;
      if (onSeekEnd) runOnJS(onSeekEnd)();
    });

  const clampedProgress = Math.max(0, Math.min(1, progress));

  const fillStyle = useAnimatedStyle(() => ({
    width: `${(dragging.value ? dragRatio.value : clampedProgress) * 100}%`,
  }));
  const knobStyle = useAnimatedStyle(() => ({
    left: `${(dragging.value ? dragRatio.value : clampedProgress) * 100}%`,
  }));

  return (
    <View testID={testID} style={[styles.container, { height }, style]} onLayout={handleLayout}>
      <GestureDetector gesture={pan}>
        <View style={styles.trackWrapper} hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}>
          <View style={[{ height, backgroundColor: trackColor || theme.colors.secondary }, styles.track]}>
            <Animated.View
              style={[styles.fill, { backgroundColor: fillColor || theme.colors.accent }, fillStyle]}
            />
            {showKnob && (
              <Animated.View
                style={[styles.knob, { backgroundColor: knobColor || theme.colors.accent }, knobStyle]}
              />
            )}
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  trackWrapper: { flex: 1 },
  track: {
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  knob: {
    position: 'absolute',
    top: '50%',
    width: 12,
    height: 12,
    borderRadius: 6,
    transform: [{ translateX: -6 }, { translateY: -6 }],
    ...theme.shadows.sharp,
  },
});
