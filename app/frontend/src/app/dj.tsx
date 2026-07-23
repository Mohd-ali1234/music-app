import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { DJStatus } from "@/src/components/dj/DJStatus";
import { Slider, Typography } from "@/src/components/ui";
import { useDJ } from "@/src/lib/dj";
import { applyDJCycle, usePlayer } from "@/src/lib/player";
import { DJConfig } from "@/src/services/dj/dj-client";
import { theme } from "@/src/theme";

/**
 * AI DJ control room.
 *
 * Two jobs: make the DJ's current reasoning visible, and let the listener tune
 * how it behaves. Every dial writes straight through to the backend config,
 * optimistically, so the UI never waits on a round trip.
 */

type DialKey = Extract<
  keyof DJConfig,
  | "narration_frequency"
  | "discovery_level"
  | "mood_consistency"
  | "artist_diversity"
  | "learning_aggressiveness"
>;

const DIALS: { key: DialKey; label: string; hint: string; low: string; high: string }[] = [
  {
    key: "discovery_level",
    label: "Discovery",
    hint: "How much unfamiliar music the DJ works in.",
    low: "Familiar",
    high: "Adventurous",
  },
  {
    key: "artist_diversity",
    label: "Artist rotation",
    hint: "How aggressively repeated artists are spread out.",
    low: "Deep dives",
    high: "Keep rotating",
  },
  {
    key: "mood_consistency",
    label: "Mood consistency",
    hint: "How tightly the DJ holds the current vibe.",
    low: "Loose",
    high: "Locked in",
  },
  {
    key: "narration_frequency",
    label: "Narration",
    hint: "How often the DJ speaks. All the way down is silent.",
    low: "Silent",
    high: "Chatty",
  },
  {
    key: "learning_aggressiveness",
    label: "Adaptation speed",
    hint: "How fast skips and replays change the next few tracks.",
    low: "Steady",
    high: "Reactive",
  },
];

export default function DJScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const config = useDJ((s) => s.config);
  const sessionId = useDJ((s) => s.sessionId);
  const insight = useDJ((s) => s.insight);
  const insightLoading = useDJ((s) => s.insightLoading);
  const loadConfig = useDJ((s) => s.loadConfig);
  const updateConfig = useDJ((s) => s.updateConfig);
  const loadInsight = useDJ((s) => s.loadInsight);
  const advance = useDJ((s) => s.advance);

  const currentSong = usePlayer((s) => s.current);

  useEffect(() => {
    if (!config) loadConfig();
  }, [config, loadConfig]);

  useEffect(() => {
    if (sessionId && !insight) loadInsight();
  }, [sessionId, insight, loadInsight]);

  const refreshQueue = useCallback(async () => {
    if (!currentSong?.id) return;
    const cycle = await advance(currentSong.id, true);
    applyDJCycle(cycle);
  }, [advance, currentSong?.id]);

  const enabled = config?.enabled ?? true;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="chevron-down" size={24} color={theme.colors.text} />
        </Pressable>
        <Typography variant="caption" weight="bold" uppercase>
          AI DJ
        </Typography>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + theme.spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* --- master switch --- */}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Typography variant="h4">Let the DJ run the session</Typography>
            <Typography variant="bodySmall" color={theme.colors.textSecondary}>
              Reads how you react and reshapes what&apos;s coming up.
            </Typography>
          </View>
          <Switch
            value={enabled}
            onValueChange={(value) => updateConfig({ enabled: value })}
            trackColor={{ false: theme.colors.border, true: theme.colors.text }}
            thumbColor={theme.colors.background}
            accessibilityLabel="Enable AI DJ"
          />
        </View>

        {/* --- live state --- */}
        {sessionId ? (
          <View style={styles.section}>
            <Typography variant="caption" weight="bold" uppercase color={theme.colors.textMuted}>
              Right now
            </Typography>
            <DJStatus />
            <Pressable
              onPress={refreshQueue}
              disabled={!currentSong?.id}
              style={[styles.button, !currentSong?.id && styles.buttonDisabled]}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={16} color={theme.colors.background} />
              <Typography
                variant="bodySmall"
                weight="bold"
                uppercase
                color={theme.colors.background}
              >
                Rebuild the queue
              </Typography>
            </Pressable>
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="disc-outline" size={28} color={theme.colors.textMuted} />
            <Typography variant="bodySmall" color={theme.colors.textMuted} align="center">
              Play something and the DJ will take it from there.
            </Typography>
          </View>
        )}

        {/* --- session read --- */}
        {sessionId && (
          <View style={styles.section}>
            <Typography variant="caption" weight="bold" uppercase color={theme.colors.textMuted}>
              Your session
            </Typography>
            <View style={styles.card}>
              {insightLoading && !insight ? (
                <ActivityIndicator color={theme.colors.textMuted} />
              ) : insight ? (
                <>
                  <Typography variant="body">{insight.summary}</Typography>
                  {insight.tags.length > 0 && (
                    <View style={styles.tags}>
                      {insight.tags.map((tag) => (
                        <View key={tag} style={styles.tag}>
                          <Typography variant="tiny" uppercase>
                            {tag}
                          </Typography>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <Typography variant="bodySmall" color={theme.colors.textMuted}>
                  Not enough listening yet.
                </Typography>
              )}
            </View>
          </View>
        )}

        {/* --- dials --- */}
        <View style={styles.section}>
          <Typography variant="caption" weight="bold" uppercase color={theme.colors.textMuted}>
            How it behaves
          </Typography>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Typography variant="body" weight="semibold">
                Energy control
              </Typography>
              <Typography variant="small" color={theme.colors.textMuted}>
                Let the DJ raise or lower the energy across a session.
              </Typography>
            </View>
            <Switch
              value={config?.energy_control ?? true}
              onValueChange={(value) => updateConfig({ energy_control: value })}
              trackColor={{ false: theme.colors.border, true: theme.colors.text }}
              thumbColor={theme.colors.background}
              accessibilityLabel="Energy control"
            />
          </View>

          {DIALS.map((dial) => (
            <View key={dial.key} style={styles.dial}>
              <View style={styles.dialHead}>
                <Typography variant="body" weight="semibold">
                  {dial.label}
                </Typography>
                <Typography variant="caption" color={theme.colors.textMuted}>
                  {Math.round((config?.[dial.key] ?? 0) * 100)}%
                </Typography>
              </View>
              <Typography variant="small" color={theme.colors.textMuted}>
                {dial.hint}
              </Typography>
              <Slider
                value={config?.[dial.key] ?? 0.5}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(value) => updateConfig({ [dial.key]: value })}
              />
              <View style={styles.dialScale}>
                <Typography variant="tiny" color={theme.colors.textMuted} uppercase>
                  {dial.low}
                </Typography>
                <Typography variant="tiny" color={theme.colors.textMuted} uppercase>
                  {dial.high}
                </Typography>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.thin,
    borderBottomColor: theme.colors.border,
  },
  headerSpacer: { width: 24 },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.xl,
  },
  section: {
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  card: {
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  tag: {
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.text,
    paddingVertical: theme.spacing.sm + 2,
  },
  buttonDisabled: {
    opacity: theme.opacity.disabled,
  },
  empty: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
  },
  dial: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  dialHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dialScale: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
