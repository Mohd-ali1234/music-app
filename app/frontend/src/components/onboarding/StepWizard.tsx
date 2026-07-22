import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";

export type StepWizardProps = {
  step: number;
  totalSteps: number;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export function StepWizard({ step, totalSteps, onBack, title, subtitle, footer, children }: StepWizardProps) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable testID="wizard-back-button" onPress={onBack} hitSlop={12} style={styles.backBtn}>
          {onBack ? <Ionicons name="chevron-back" size={24} color={theme.colors.text} /> : null}
        </Pressable>
        <View style={styles.progress}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View key={i} style={[styles.segment, i <= step && styles.segmentActive]} />
          ))}
        </View>
      </View>
      {(title || subtitle) && (
        <View style={styles.titleWrap}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      )}
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  backBtn: { width: 24, height: 24 },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
  },
  segmentActive: { backgroundColor: theme.colors.green },
  titleWrap: { paddingHorizontal: 20, marginTop: 22 },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  body: { flex: 1, marginTop: 20 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
});
