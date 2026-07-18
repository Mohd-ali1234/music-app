import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '@/src/theme';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  borderRadius?: number;
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  onPress,
  style,
  testID,
  borderRadius = theme.radius.lg,
}: CardProps) {
  const baseStyles = [
    styles.base,
    variantStyles[variant],
    paddingStyles[padding],
    { borderRadius },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [
          ...baseStyles,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View testID={testID} style={baseStyles}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {},
  pressed: { opacity: theme.opacity.pressed },
});

const variantStyles = {
  default: {
    backgroundColor: theme.colors.card,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border,
  },
  elevated: {
    backgroundColor: theme.colors.card,
    ...theme.shadows.sharp,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: theme.borderWidth.medium,
    borderColor: theme.colors.borderStrong,
  },
  filled: {
    backgroundColor: theme.colors.secondary,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border,
  },
};

const paddingStyles = {
  none: {},
  sm: { padding: theme.spacing.sm },
  md: { padding: theme.spacing.md },
  lg: { padding: theme.spacing.lg },
  xl: { padding: theme.spacing.xl },
};