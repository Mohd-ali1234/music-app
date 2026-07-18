import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextStyle,
  ViewStyle,
  StyleProp,
} from "react-native";

import { theme } from "@/src/theme";

// Brutalist heading — very bold, condensed, uppercase, tight tracking.
// Falls back to system-ui heavy weight when custom fonts aren't loaded.
export function BrutalHeading({
  children,
  size = "lg",
  color,
  style,
  numberOfLines,
  testID,
}: {
  children: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
  color?: string;
  style?: TextStyle;
  numberOfLines?: number;
  testID?: string;
}) {
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[styles.heading, sizeMap[size], color && { color }, style]}
    >
      {children}
    </Text>
  );
}

export function BrutalLabel({
  children,
  color = theme.colors.textMuted,
  style,
  testID,
}: {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  return (
    <Text testID={testID} style={[styles.label, { color }, style]}>
      {children}
    </Text>
  );
}

export function BrutalDivider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  heading: {
    color: theme.colors.text,
    fontWeight: "900",
    letterSpacing: -1,
    textTransform: "uppercase",
    fontFamily: undefined,
  },
  label: {
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
});

const sizeMap: Record<string, TextStyle> = {
  xs: { fontSize: 16, lineHeight: 18 },
  sm: { fontSize: 22, lineHeight: 24 },
  md: { fontSize: 32, lineHeight: 32 },
  lg: { fontSize: 44, lineHeight: 44 },
  xl: { fontSize: 64, lineHeight: 62 },
  xxl: { fontSize: 88, lineHeight: 84 },
};
