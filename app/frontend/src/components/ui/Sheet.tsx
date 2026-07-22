import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '@/src/theme';

export interface SheetProps {
  /** Rendered inside the draggable handle strip (e.g. close/more buttons). Optional. */
  header?: React.ReactNode;
  /** Main scrollable body — not gesture-attached, so inner ScrollViews behave normally. */
  children: React.ReactNode;
  onDismiss?: () => void;
  dismissThreshold?: number;
  style?: ViewStyle;
  testID?: string;
}

/**
 * A drag-to-dismiss sheet shell. Only the handle strip (grabber + optional
 * header content) is gesture-attached, so nested ScrollViews in `children`
 * never fight the pan gesture for touches.
 */
export function Sheet({
  header,
  children,
  onDismiss,
  dismissThreshold = 120,
  style,
  testID,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const startY = useSharedValue(0);

  const handleDismiss = () => {
    onDismiss?.();
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateY.value = Math.max(0, startY.value + e.translationY);
    })
    .onEnd((e) => {
      if (translateY.value > dismissThreshold || e.velocityY > 800) {
        translateY.value = withTiming(
          600,
          { duration: theme.motion.duration.slow },
          (finished) => {
            if (finished && onDismiss) runOnJS(handleDismiss)();
          },
        );
      } else {
        translateY.value = withSpring(0, theme.motion.spring.snappy);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View testID={testID} style={[styles.sheet, animatedStyle, style]}>
      <GestureDetector gesture={pan}>
        <View style={[styles.handleStrip, { paddingTop: insets.top }]}>
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>
          {header}
        </View>
      </GestureDetector>
      <View style={[styles.body, { paddingBottom: insets.bottom }]}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    overflow: 'hidden',
  },
  handleStrip: {},
  grabberWrap: {
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderStrong,
  },
  body: { flex: 1 },
});
