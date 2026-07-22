import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '@/src/theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Fire a light haptic tap on press. Defaults to true; set false for rapid-fire/no-ops. */
  haptic?: boolean;
  testID?: string;
  style?: any;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  haptic = true,
  testID,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: theme.motion.duration.fast });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: theme.motion.duration.fast });
  };
  const handlePress = () => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const baseStyles = [
    styles.base,
    sizeStyles[size],
    variantStyles[variant],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];

  return (
    <Pressable
      testID={testID}
      onPress={isDisabled ? undefined : handlePress}
      onPressIn={isDisabled ? undefined : handlePressIn}
      onPressOut={isDisabled ? undefined : handlePressOut}
      disabled={isDisabled}
    >
      <Animated.View style={[...baseStyles, animatedStyle]}>
        {loading ? (
          <View style={styles.spinnerContainer}>
            <ActivityIndicator
              color={variant === 'primary' ? '#FFF' : theme.colors.text}
              size="small"
            />
          </View>
        ) : (
          <View style={styles.content}>
            {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
            <Text style={[
              styles.text,
              sizeTextStyles[size],
              variantTextStyles[variant],
            ]}>
              {title}
            </Text>
            {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.thin,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: theme.opacity.disabled },
  content: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  iconLeft: { marginRight: theme.spacing.xs },
  iconRight: { marginLeft: theme.spacing.xs },
  text: { fontWeight: theme.fontWeight.bold, letterSpacing: theme.letterSpacing.uppercase },
  spinnerContainer: { paddingVertical: theme.spacing.xs },
});

const sizeStyles = {
  sm: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, minHeight: 36 },
  md: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, minHeight: 48 },
  lg: { paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, minHeight: 56 },
  xl: { paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.lg, minHeight: 64 },
};

const sizeTextStyles = {
  sm: { fontSize: theme.font.caption },
  md: { fontSize: theme.font.bodySmall },
  lg: { fontSize: theme.font.body },
  xl: { fontSize: theme.font.bodyLarge },
};

const variantStyles = {
  primary: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  secondary: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: theme.colors.danger,
    borderColor: theme.colors.danger,
  },
};

const variantTextStyles = {
  primary: { color: theme.colors.background },
  secondary: { color: theme.colors.text },
  outline: { color: theme.colors.text },
  ghost: { color: theme.colors.textSecondary },
  danger: { color: '#FFF' },
};
