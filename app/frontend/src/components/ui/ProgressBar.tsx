import React from 'react';
import { View, StyleSheet, Pressable, PanResponder } from 'react-native';
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
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!onSeek,
      onMoveShouldSetPanResponder: () => !!onSeek,
      onPanResponderGrant: () => onSeekStart?.(),
      onPanResponderMove: (_, gestureState) => {
        if (!onSeek) return;
        const { locationX } = gestureState;
        // We'll handle the width calculation in onLayout
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!onSeek) return;
        onSeekEnd?.();
      },
      onPanResponderTerminate: () => onSeekEnd?.(),
    })
  ).current;

  const [trackWidth, setTrackWidth] = React.useState(0);

  const handleLayout = (e: any) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const handlePanMove = (e: any) => {
    if (!onSeek || trackWidth === 0) return;
    const x = e.nativeEvent.locationX;
    const newProgress = Math.max(0, Math.min(1, x / trackWidth));
    onSeek(newProgress);
  };

  const handlePress = (e: any) => {
    if (!onSeek || trackWidth === 0) return;
    onSeekStart?.();
    const x = e.nativeEvent.locationX;
    const newProgress = Math.max(0, Math.min(1, x / trackWidth));
    onSeek(newProgress);
    onSeekEnd?.();
  };

  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <View
      testID={testID}
      style={[styles.container, { height }, style]}
      onLayout={handleLayout}
    >
      <Pressable
        {...panResponder.panHandlers}
        onPress={handlePress}
        onPressIn={onSeekStart}
        onPressOut={onSeekEnd}
        style={styles.trackWrapper}
        hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
      >
        <View style={[{ height, backgroundColor: trackColor || theme.colors.secondary }, styles.track]}>
          <View
            style={[
              styles.fill,
              { width: `${clampedProgress * 100}%`, backgroundColor: fillColor || theme.colors.accent },
            ]}
          />
          {showKnob && (
            <View
              style={[
                styles.knob,
                { left: `${clampedProgress * 100}%`, backgroundColor: knobColor || theme.colors.accent },
              ]}
            />
          )}
        </View>
      </Pressable>
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