import React from "react";
import { StyleSheet, View } from "react-native";

import { Typography } from "@/src/components/ui";
import { DJ_INTENT_LABELS, useDJ } from "@/src/lib/dj";
import { theme } from "@/src/theme";

/**
 * A compact read-out of what the DJ is currently doing and why.
 *
 * Exists to make the DJ legible rather than magical: the listener can see the
 * decision ("Rotating artists") and the evidence behind it (skip rate, energy,
 * tracks played). Renders nothing until a session is live.
 */
export function DJStatus({ compact = false }: { compact?: boolean }) {
  const intent = useDJ((s) => s.intent);
  const signals = useDJ((s) => s.signals);
  const notes = useDJ((s) => s.notes);

  if (!intent || !signals) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.dot} />
        <Typography variant="caption" weight="bold" uppercase>
          {DJ_INTENT_LABELS[intent] ?? intent}
        </Typography>
      </View>

      <View style={styles.stats}>
        <Stat label="Tracks" value={String(signals.tracks_played)} />
        <Stat label="Kept" value={pct(signals.completion_rate)} />
        <Stat label="Skipped" value={pct(signals.skip_rate)} />
        <Stat label="Energy" value={pct(signals.energy)} />
      </View>

      {!compact && notes.length > 0 && (
        <View style={styles.notes}>
          {notes.map((note) => (
            <Typography
              key={note}
              variant="small"
              color={theme.colors.textMuted}
              numberOfLines={1}
            >
              — {note}
            </Typography>
          ))}
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Typography variant="bodySmall" weight="bold">
        {value}
      </Typography>
      <Typography variant="tiny" color={theme.colors.textMuted} uppercase>
        {label}
      </Typography>
    </View>
  );
}

function pct(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.sm,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    backgroundColor: theme.colors.success,
  },
  stats: {
    flexDirection: "row",
    gap: theme.spacing.lg,
  },
  stat: {
    gap: 2,
  },
  notes: {
    gap: 2,
    borderTopWidth: theme.borderWidth.thin,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
});
