import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { theme } from '@/src/theme';

export interface TypographyProps {
  children: React.ReactNode;
  variant?: 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodyLarge' | 'bodySmall' | 'caption' | 'small' | 'tiny' | 'mono';
  weight?: keyof typeof theme.fontWeight;
  color?: string;
  align?: 'left' | 'center' | 'right';
  uppercase?: boolean;
  letterSpacing?: number;
  numberOfLines?: number;
  style?: any;
  testID?: string;
}

export function Typography({
  children,
  variant = 'body',
  weight = 'regular',
  color,
  align = 'left',
  uppercase = false,
  letterSpacing,
  numberOfLines,
  style,
  testID,
}: TypographyProps) {
  const textStyles = [
    styles.base,
    variantStyles[variant],
    weightStyles[weight],
    alignStyles[align],
    uppercase && styles.uppercase,
    letterSpacing !== undefined && { letterSpacing },
    color && { color },
    style,
  ];

  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={textStyles}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: undefined,
  },
  uppercase: {
    textTransform: 'uppercase',
    letterSpacing: theme.letterSpacing.uppercase,
  },
});

const variantStyles = {
  display: { fontSize: theme.font.display, fontWeight: theme.fontWeight.black, lineHeight: theme.font.display * 1.1 },
  h1: { fontSize: theme.font.h1, fontWeight: theme.fontWeight.black, lineHeight: theme.font.h1 * 1.15 },
  h2: { fontSize: theme.font.h2, fontWeight: theme.fontWeight.heavy, lineHeight: theme.font.h2 * 1.2 },
  h3: { fontSize: theme.font.h3, fontWeight: theme.fontWeight.bold, lineHeight: theme.font.h3 * 1.3 },
  h4: { fontSize: theme.font.h4, fontWeight: theme.fontWeight.bold, lineHeight: theme.font.h4 * 1.35 },
  body: { fontSize: theme.font.body, fontWeight: theme.fontWeight.regular, lineHeight: theme.font.body * 1.5 },
  bodyLarge: { fontSize: theme.font.bodyLarge, fontWeight: theme.fontWeight.regular, lineHeight: theme.font.bodyLarge * 1.5 },
  bodySmall: { fontSize: theme.font.bodySmall, fontWeight: theme.fontWeight.regular, lineHeight: theme.font.bodySmall * 1.5 },
  caption: { fontSize: theme.font.caption, fontWeight: theme.fontWeight.medium, lineHeight: theme.font.caption * 1.5 },
  small: { fontSize: theme.font.small, fontWeight: theme.fontWeight.regular, lineHeight: theme.font.small * 1.5 },
  tiny: { fontSize: theme.font.tiny, fontWeight: theme.fontWeight.medium, lineHeight: theme.font.tiny * 1.5 },
  mono: { fontSize: theme.font.mono, fontWeight: theme.fontWeight.regular, lineHeight: theme.font.mono * 1.5, fontFamily: 'monospace' },
};

const weightStyles = {
  light: { fontWeight: theme.fontWeight.light },
  regular: { fontWeight: theme.fontWeight.regular },
  medium: { fontWeight: theme.fontWeight.medium },
  semibold: { fontWeight: theme.fontWeight.semibold },
  bold: { fontWeight: theme.fontWeight.bold },
  heavy: { fontWeight: theme.fontWeight.heavy },
  black: { fontWeight: theme.fontWeight.black },
};

const alignStyles = {
  left: { textAlign: 'left' },
  center: { textAlign: 'center' },
  right: { textAlign: 'right' },
};