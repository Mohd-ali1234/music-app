import React from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { DJStatus } from "@/src/components/dj/DJStatus";
import { Typography } from "@/src/components/ui";
import { Song } from "@/src/lib/api";
import { formatTime, usePlayer } from "@/src/lib/player";
import { useUI } from "@/src/lib/ui";
import { theme } from "@/src/theme";

/**
 * The persistent "up next" column, shown on wide desktop layouts.
 *
 * On mobile the queue is a modal route (`/queue`) because there is no room for
 * it; from 1440px up there is, and keeping it visible is the single biggest
 * desktop affordance a music app has — you can see where the session is going
 * without leaving the page.
 *
 * Also surfaces the DJ's current reasoning, so a queue that just changed
 * explains itself in place.
 */

export const QUEUE_PANEL_WIDTH = 320;

export function QueuePanel() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playFromQueue = usePlayer((s) => s.playFromQueue);
  const removeQueueItem = usePlayer((s) => s.removeQueueItem);
  const close = useUI((s) => s.toggleQueuePanel);

  const upcoming = queue.slice(index + 1);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Typography variant="caption" weight="bold" uppercase>
          Up next
        </Typography>
        <Pressable
          onPress={close}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Hide queue panel"
        >
          <Ionicons name="close" size={16} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.djSlot}>
        <DJStatus compact />
      </View>

      {upcoming.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="layers-outline" size={22} color={theme.colors.textMuted} />
          <Typography variant="small" color={theme.colors.textMuted} align="center">
            Nothing queued yet.
          </Typography>
        </View>
      ) : (
        <FlatList
          data={upcoming}
          keyExtractor={(item, i) => `${item.id ?? item.yt_video_id ?? i}-${i}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index: offset }) => (
            <QueueRow
              song={item}
              onPlay={() => playFromQueue(index + 1 + offset)}
              onRemove={() => removeQueueItem(index + 1 + offset)}
            />
          )}
        />
      )}
    </View>
  );
}

function QueueRow({
  song,
  onPlay,
  onRemove,
}: {
  song: Song;
  onPlay: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable
      onPress={onPlay}
      accessibilityRole="button"
      accessibilityLabel={`Play ${song.title}`}
      style={({ hovered }: any) => [styles.row, hovered && styles.rowHovered]}
    >
      <Image
        source={song.artwork ? { uri: song.artwork } : undefined}
        style={styles.art}
        contentFit="cover"
      />
      <View style={styles.rowText}>
        <Typography variant="bodySmall" numberOfLines={1}>
          {song.title || "Unknown title"}
        </Typography>
        <Typography variant="tiny" color={theme.colors.textMuted} numberOfLines={1}>
          {song.artist || "Unknown artist"}
        </Typography>
      </View>
      <Typography variant="tiny" color={theme.colors.textMuted}>
        {formatTime(song.duration)}
      </Typography>
      <Pressable
        onPress={onRemove}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${song.title} from queue`}
        style={styles.remove}
      >
        <Ionicons name="close" size={13} color={theme.colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: QUEUE_PANEL_WIDTH,
    backgroundColor: theme.colors.card,
    borderLeftWidth: theme.borderWidth.thin,
    borderLeftColor: theme.colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderBottomWidth: theme.borderWidth.thin,
    borderBottomColor: theme.colors.border,
  },
  djSlot: {
    padding: theme.spacing.sm,
  },
  list: {
    paddingBottom: theme.spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs + 2,
  },
  rowHovered: {
    backgroundColor: theme.colors.overlayLight,
  },
  art: {
    width: 36,
    height: 36,
    backgroundColor: theme.colors.secondary,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  remove: {
    padding: 2,
  },
  empty: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
  },
});
