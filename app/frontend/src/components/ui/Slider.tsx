import React from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
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
  const [trackWidth, setTrackWidth] = React.useState(0);
  const [isSliding, setIsSliding] = React.useState(false);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !!onValueChange,
      onMoveShouldSetPanResponder: () => !disabled && !!onValueChange,
      onPanResponderGrant: () => {
        setIsSliding(true);
        onSlidingStart?.();
      },
      onPanResponderMove: (_, gestureState) => {
        if (disabled || !onValueChange || trackWidth === 0) return;
        const x = gestureState.moveX;
        const ratio = Math.max(0, Math.min(1, x / trackWidth));
        let newValue = min + ratio * (max - min);
        if (step > 0) {
          newValue = Math.round(newValue / step) * step;
        }
        newValue = Math.max(min, Math.min(max, newValue));
        onValueChange(newValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsSliding(false);
        if (disabled || !onValueChange || trackWidth === 0) return;
        const x = gestureState.moveX;
        const ratio = Math.max(0, Math.min(1, x / trackWidth));
        let newValue = min + ratio * (max - min);
        if (step > 0) {
          newValue = Math.round(newValue / step) * step;
        }
        newValue = Math.max(min, Math.min(max, newValue));
        onSlidingComplete?.(newValue);
      },
      onPanResponderTerminate: () => {
        setIsSliding(false);
        onSlidingComplete?.(value);
      },
    })
  ).current;

  const clampedValue = Math.max(min, Math.min(max, Math.min(max, value)));
  const ratio = (clampedValue - min) / (max - min);

  return (
    <View
      testID={testID}
      style={[styles.container, { height: thumbSize }, style]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <View
        {...panResponder.panHandlers}
        style={[
          styles.trackWrapper,
          { height: trackHeight, top: (thumbSize - trackHeight) / 2 },
        ]}
        hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
      >
        <View
          style={[
            styles.track,
            { backgroundColor: trackColor || theme.colors.secondary, height: trackHeight },
          ]}
        >
          <View
            style={[
              styles.fill,
              { width: `${ratio * 100}%`, backgroundColor: fillColor || theme.colors.accent, height: trackHeight },
            ]}
          />
        </View>
        <View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              left: `calc(${ratio * 100}% - ${thumbSize / 2}px)`,
              backgroundColor: thumbColor || theme.colors.accent,
              transform: [{ translateX: 0 }],
            },
            isSliding && styles.thumbActive,
            disabled && styles.thumbDisabled,
          ]}
        />
      </View>
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
  thumbActive: { transform: [{ scale: 1.3 }] },
  thumbDisabled: { opacity: theme.opacity.disabled },
});