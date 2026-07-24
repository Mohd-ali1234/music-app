import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { Button } from "@/src/components/ui/Button";
import { BrutalHeading, BrutalLabel } from "@/src/components/brutal/BrutalText";
import { settingsClient } from "@/src/services/settings/settings-client";

export default function AISettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [suffix, setSuffix] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await settingsClient.getAISettings();
      setConfigured(s.gemini_key_configured);
      setSuffix(s.gemini_key_suffix);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setStatus({ kind: "error", text: "Enter a Gemini API key first." });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const s = await settingsClient.saveGeminiKey(trimmed);
      setConfigured(s.gemini_key_configured);
      setSuffix(s.gemini_key_suffix);
      setKey("");
      setStatus({ kind: "ok", text: "Key saved. It's active immediately." });
    } catch (e: any) {
      setStatus({ kind: "error", text: e.message || "Failed to save key." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Ionicons
            name="chevron-back"
            size={22}
            color={theme.colors.text}
            onPress={() => router.back()}
            testID="ai-settings-back"
          />
          <BrutalHeading size="lg">AI PROVIDER</BrutalHeading>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        >
          <BrutalLabel style={styles.sectionLabel}>GEMINI API KEY</BrutalLabel>

          <View style={styles.card}>
            {loading ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <Text style={styles.statusLine} testID="ai-settings-current-status">
                {configured
                  ? `CURRENT KEY: •••• ${suffix}`
                  : "NO KEY CONFIGURED — AI FEATURES USE A FALLBACK"}
              </Text>
            )}

            <TextInput
              testID="ai-settings-key-input"
              placeholder="Paste your Gemini API key"
              placeholderTextColor={theme.colors.textMuted}
              value={key}
              onChangeText={setKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={styles.input}
            />

            {status && (
              <Text
                style={[
                  styles.statusMessage,
                  status.kind === "error" && styles.statusError,
                ]}
                testID="ai-settings-message"
              >
                {status.text}
              </Text>
            )}

            <Button
              title={configured ? "REPLACE KEY" : "SAVE KEY"}
              onPress={save}
              loading={saving}
              disabled={saving}
              fullWidth
              testID="ai-settings-save-button"
              style={styles.saveButton}
            />

            <Text style={styles.hint}>
              Get a key from Google AI Studio. It's stored securely on this
              device and used for AI DJ insights and playlist generation. You
              can update or replace it here at any time.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sectionLabel: { paddingHorizontal: 20, paddingBottom: 12 },
  card: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 14,
  },
  statusLine: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: theme.colors.secondary,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  statusMessage: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusError: {
    color: theme.colors.danger,
  },
  saveButton: {
    borderRadius: 0,
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
});
