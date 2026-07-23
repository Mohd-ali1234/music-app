import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Slider, Typography } from "@/src/components/ui";
import { useBreakpoint } from "@/src/hooks/use-breakpoint";
import { formatTime, usePlayer } from "@/src/lib/player";
import { useUI } from "@/src/lib/ui";
import { theme } from "@/src/theme";

/**
 * The persistent desktop transport bar.
 *
 * Desktop conventions differ from mobile in a way that matters: there is room
 * for a real scrubber, a visible time read-out and secondary controls, so the
 * bar is a three-zone layout (track / transport / actions) rather than the
 * compact tap-to-expand MiniPlayer used on phones.
 *
 * Mobile continues to render `MiniPlayer`; this component is desktop-only.
 */

export const NOW_PLAYING_BAR_HEIGHT = 84;

export function NowPlayingBar() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const toggleQueuePanel = useUI((s) => s.toggleQueuePanel);
  const queuePanelOpen = useUI((s) => s.queuePanelOpen);

  const current = usePlayer((s) => s.current);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const likedIds = usePlayer((s) => s.likedIds);

  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const seek = usePlayer((s) => s.seek);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const toggleLike = usePlayer((s) => s.toggleLike);

  if (!current) return null;

  const liked = likedIds.has(current.id);

  return (
    <View style={styles.bar}>
      {/* --- track --- */}
      <Pressable
        style={styles.track}
        onPress={() => router.push("/player")}
        accessibilityRole="button"
        accessibilityLabel="Open full player"
      >
        <Image
          source={current.artwork ? { uri: current.artwork } : undefined}
          style={styles.art}
          contentFit="cover"
        />
        <View style={styles.trackText}>
          <Typography variant="bodySmall" weight="semibold" numberOfLines={1}>
            {current.title || "Unknown title"}
          </Typography>
          <Typography
            variant="small"
            color={theme.colors.textMuted}
            numberOfLines={1}
          >
            {current.artist || "Unknown artist"}
          </Typography>
        </View>
        <IconButton
          icon={liked ? "heart" : "heart-outline"}
          label={liked ? "Unlike" : "Like"}
          color={liked ? theme.colors.liked : theme.colors.textSecondary}
          onPress={() => toggleLike(current.id)}
        />
      </Pressable>

      {/* --- transport --- */}
      <View style={styles.transport}>
        <View style={styles.buttons}>
          <IconButton
            icon="shuffle"
            label="Shuffle"
            color={shuffle ? theme.colors.text : theme.colors.textMuted}
            onPress={toggleShuffle}
          />
          <IconButton icon="play-skip-back" label="Previous" onPress={prev} size={20} />
          <Pressable
            onPress={togglePlay}
            style={styles.playButton}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={20}
              color={theme.colors.background}
            />
          </Pressable>
          <IconButton icon="play-skip-forward" label="Next" onPress={next} size={20} />
          <IconButton
            icon={repeat === "one" ? "repeat" : "repeat"}
            label={`Repeat: ${repeat}`}
            color={repeat === "off" ? theme.colors.textMuted : theme.colors.text}
            onPress={cycleRepeat}
          />
        </View>

        <View style={styles.scrubber}>
          <Typography variant="tiny" color={theme.colors.textMuted}>
            {formatTime(position)}
          </Typography>
          <View style={styles.sliderWrap}>
            <Slider
              value={duration > 0 ? position / duration : 0}
              min={0}
              max={1}
              onValueChange={(value) => seek(value * duration)}
            />
          </View>
          <Typography variant="tiny" color={theme.colors.textMuted}>
            {formatTime(duration)}
          </Typography>
        </View>
      </View>

      {/* --- actions --- */}
      <View style={styles.actions}>
        {/* Wide layouts toggle the side panel in place; narrower desktop
            windows have no room for it and fall back to the modal route. */}
        <IconButton
          icon="list"
          label={isWide ? "Toggle queue panel" : "Queue"}
          color={
            isWide && queuePanelOpen
              ? theme.colors.text
              : theme.colors.textSecondary
          }
          onPress={() => (isWide ? toggleQueuePanel() : router.push("/queue"))}
        />
        <IconButton
          icon="radio-outline"
          label="AI DJ"
          onPress={() => router.push("/dj" as never)}
        />
        <IconButton
          icon="expand-outline"
          label="Full player"
          onPress={() => router.push("/player")}
        />
      </View>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  color = theme.colors.textSecondary,
  size = 17,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ hovered }: any) => [styles.iconButton, hovered && styles.iconHovered]}
    >
      <Ionicons name={icon as any} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: NOW_PLAYING_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderTopWidth: theme.borderWidth.thin,
    borderTopColor: theme.colors.border,
  },
  track: {
    flex: 1,
    minWidth: 180,
    maxWidth: 360,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  art: {
    width: 52,
    height: 52,
    backgroundColor: theme.colors.secondary,
  },
  trackText: {
    flex: 1,
    gap: 1,
  },
  transport: {
    flex: 2,
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  buttons: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  playButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.text,
  },
  scrubber: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    width: "100%",
    maxWidth: 560,
  },
  sliderWrap: {
    flex: 1,
  },
  actions: {
    flex: 1,
    maxWidth: 200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.md,
  },
  iconButton: {
    padding: theme.spacing.xs,
  },
  iconHovered: {
    opacity: 0.7,
  },
});
