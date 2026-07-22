import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { usePlayer, formatTime } from "@/src/lib/player";
import { theme } from "@/src/theme";
import { Sheet, AlbumCover, ProgressBar, Typography } from "@/src/components/ui";

function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export default function PlayerScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const artSize = isWide ? 420 : Math.min(width - theme.spacing.lg * 2, 480);
  const current = usePlayer((s) => s.current);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const isLoading = usePlayer((s) => s.isLoading);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const seek = usePlayer((s) => s.seek);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const toggleLike = usePlayer((s) => s.toggleLike);
  const liked = usePlayer((s) => (current ? s.likedIds.has(current.id) : false));
  const queue = usePlayer((s) => s.queue);
  const queueIndex = usePlayer((s) => s.index);
  const playFromQueue = usePlayer((s) => s.playFromQueue);

  const dismiss = () => router.back();

  if (!current) {
    return (
      <Sheet onDismiss={dismiss} header={<PlayerHeader onClose={dismiss} />}>
        <View style={styles.emptyWrap}>
          <Ionicons name="musical-notes-outline" size={32} color={theme.colors.textMuted} />
          <Typography variant="bodySmall" color={theme.colors.textMuted} uppercase style={{ marginTop: theme.spacing.md }}>
            No track playing
          </Typography>
        </View>
      </Sheet>
    );
  }

  const progress = duration > 0 ? position / duration : 0;
  const upNext = queue.slice(queueIndex + 1, queueIndex + 4);
  const hasMoreQueued = queue.length - queueIndex - 1 > upNext.length;

  return (
    <Sheet onDismiss={dismiss} header={<PlayerHeader onClose={dismiss} />}>
      <View style={styles.screen}>
        {current.artwork ? (
          <Image
            source={{ uri: current.artwork }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={70}
          />
        ) : null}
        <View style={styles.screenScrim} />
        <ScrollView
          contentContainerStyle={[styles.body, isWide && styles.bodyWide]}
          showsVerticalScrollIndicator={false}
        >
        <View style={[styles.playerGrid, isWide && styles.playerGridWide]}>
          {/* Artwork */}
          <View style={[styles.artColumn, isWide && styles.artColumnWide]}>
            <Animated.View
              key={current.id}
              entering={FadeIn.duration(theme.motion.duration.slow)}
              style={[
                styles.artWrap,
                { width: artSize, height: artSize },
                isWide && styles.artWrapWide,
              ]}
            >
              <AlbumCover source={current.artwork} size={artSize} contentFit="cover" />
              {isLoading && (
                <View style={styles.loadOverlay}>
                  <ActivityIndicator color={theme.colors.text} />
                </View>
              )}
            </Animated.View>
          </View>

          <View style={[styles.detailsColumn, isWide && styles.detailsColumnWide]}>
            {/* Title + like */}
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Typography variant="h3" weight="black" numberOfLines={1} letterSpacing={0.3}>
                  {current.title?.toUpperCase()}
                </Typography>
                <Typography
                  variant="caption"
                  weight="semibold"
                  color={theme.colors.textMuted}
                  numberOfLines={1}
                  style={{ marginTop: theme.spacing.xs, letterSpacing: 1.1 }}
                >
                  {current.artist?.toUpperCase()}
                </Typography>
              </View>
              <Pressable
                testID="player-like-btn"
                onPress={() => {
                  tap();
                  toggleLike(current.id);
                }}
                hitSlop={12}
                style={styles.iconTouchTarget}
              >
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={28}
                  color={liked ? theme.colors.text : theme.colors.textMuted}
                />
              </Pressable>
            </View>

            {/* Progress */}
            <View style={styles.progress}>
              <ProgressBar
                testID="seek-bar"
                progress={progress}
                onSeek={(ratio) => seek(ratio * (duration || current.duration))}
                height={4}
                showKnob
              />
              <View style={styles.timeRow}>
                <Typography variant="tiny" color={theme.colors.textMuted} style={{ fontVariant: ["tabular-nums"] }}>
                  {formatTime(position)}
                </Typography>
                <Typography variant="tiny" color={theme.colors.textMuted} style={{ fontVariant: ["tabular-nums"] }}>
                  {formatTime(duration || current.duration)}
                </Typography>
              </View>
            </View>

            {/* Transport controls */}
            <View style={styles.controls}>
              <Pressable
                testID="shuffle-btn"
                onPress={() => {
                  tap();
                  toggleShuffle();
                }}
                hitSlop={12}
                style={styles.iconTouchTarget}
              >
                <Ionicons name="shuffle" size={22} color={shuffle ? theme.colors.text : theme.colors.textMuted} />
              </Pressable>
              <Pressable testID="prev-btn" onPress={prev} hitSlop={12} style={styles.iconTouchTarget}>
                <Ionicons name="play-skip-back" size={30} color={theme.colors.text} />
              </Pressable>
              <Pressable
                testID="play-pause-btn"
                onPress={() => {
                  tap();
                  togglePlay();
                }}
                style={styles.playBig}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.colors.background} />
                ) : (
                  <Ionicons name={isPlaying ? "pause" : "play"} size={30} color={theme.colors.background} />
                )}
              </Pressable>
              <Pressable testID="next-btn" onPress={next} hitSlop={12} style={styles.iconTouchTarget}>
                <Ionicons name="play-skip-forward" size={30} color={theme.colors.text} />
              </Pressable>
              <Pressable
                testID="repeat-btn"
                onPress={() => {
                  tap();
                  cycleRepeat();
                }}
                hitSlop={12}
                style={styles.iconTouchTarget}
              >
                <Ionicons name="repeat" size={22} color={repeat !== "off" ? theme.colors.text : theme.colors.textMuted} />
                {repeat === "one" && (
                  <View style={styles.repeatDot}>
                    <Text style={styles.repeatDotText}>1</Text>
                  </View>
                )}
                {repeat === "all" && (
                  <View style={styles.repeatAllBadge}>
                    <Text style={styles.repeatAllText}>ALL</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* Up Next preview */}
        <View style={[styles.queueCard, isWide && styles.queueCardWide]}>
          <View style={styles.queueCardHeader}>
            <Typography variant="caption" weight="bold" color={theme.colors.textMuted} uppercase letterSpacing={1.5}>
              Up Next
            </Typography>
            <Pressable
              testID="see-full-queue"
              onPress={() => router.push("/queue")}
              hitSlop={8}
              style={styles.seeQueueBtn}
            >
              <Typography variant="tiny" weight="bold" color={theme.colors.text} uppercase letterSpacing={1}>
                {hasMoreQueued ? `See all (${queue.length - queueIndex - 1})` : "See queue"}
              </Typography>
              <Ionicons name="chevron-forward" size={14} color={theme.colors.text} />
            </Pressable>
          </View>

          {upNext.length ? (
            upNext.map((song, offset) => {
              const actualIndex = queueIndex + offset + 1;
              return (
                <Pressable
                  key={`${song.id}-${actualIndex}`}
                  testID={`queue-preview-${actualIndex}`}
                  onPress={() => playFromQueue(actualIndex)}
                  style={({ pressed }) => [styles.queueRow, pressed && styles.queueRowPressed]}
                >
                  <AlbumCover source={song.artwork} size={40} />
                  <View style={styles.queueInfo}>
                    <Typography variant="caption" weight="bold" numberOfLines={1} letterSpacing={0.3}>
                      {song.title?.toUpperCase()}
                    </Typography>
                    <Typography variant="tiny" color={theme.colors.textMuted} numberOfLines={1} style={{ marginTop: 3, letterSpacing: 0.8 }}>
                      {song.artist?.toUpperCase()}
                    </Typography>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.queueEmpty}>
              <Ionicons name="checkmark-circle-outline" size={26} color={theme.colors.textMuted} />
              <Typography variant="bodySmall" color={theme.colors.textMuted} style={{ marginTop: theme.spacing.sm }}>
                This is the last song in the queue
              </Typography>
            </View>
          )}
        </View>
        </ScrollView>
      </View>
    </Sheet>
  );
}

function PlayerHeader({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable testID="player-close" onPress={onClose} hitSlop={12} style={styles.headerBtn}>
        <Ionicons name="chevron-down" size={26} color={theme.colors.text} />
      </Pressable>
      <Pressable testID="player-more" hitSlop={12} style={styles.headerBtn}>
        <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },

  screen: { flex: 1 },
  screenScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    opacity: 0.88,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  headerBtn: { padding: theme.spacing.xs },

  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
  },
  bodyWide: { paddingHorizontal: theme.spacing.xxl },

  playerGrid: { width: "100%" },
  playerGridWide: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xxxl - theme.spacing.sm,
    paddingTop: theme.spacing.lg,
  },
  artColumn: { width: "100%", alignItems: "center" },
  artColumnWide: { width: "46%", maxWidth: 480 },
  detailsColumn: { width: "100%" },
  detailsColumnWide: { flex: 1 },

  artWrap: {
    marginTop: theme.spacing.md,
    position: "relative",
  },
  artWrapWide: {
    marginTop: 0,
    ...theme.shadows.sharpLarge,
  },
  loadOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.overlay,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  iconTouchTarget: { padding: theme.spacing.xs },

  progress: { marginTop: theme.spacing.lg },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.spacing.sm,
  },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xs,
  },
  playBig: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.sharp,
  },
  repeatDot: {
    position: "absolute",
    top: -6,
    right: -8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  repeatDotText: { color: theme.colors.background, fontSize: 8, fontWeight: "700" },
  repeatAllBadge: {
    position: "absolute",
    top: -7,
    right: -12,
    backgroundColor: theme.colors.text,
    borderRadius: 5,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  repeatAllText: { color: theme.colors.background, fontSize: 7, fontWeight: "800" },

  queueCard: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.card,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  queueCardWide: { marginTop: theme.spacing.xxl },
  queueCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  seeQueueBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: theme.spacing.xs },

  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  queueRowPressed: { opacity: theme.opacity.pressed },
  queueInfo: { flex: 1, minWidth: 0 },

  queueEmpty: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
  },
});
