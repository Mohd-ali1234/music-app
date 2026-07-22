import React from "react";
import { View, StyleSheet, Pressable, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { usePlayer } from "@/src/lib/player";
import { Song } from "@/src/lib/api";
import { theme } from "@/src/theme";
import { Sheet, AlbumCover, Typography } from "@/src/components/ui";

const ROW_HEIGHT = 68;
const REMOVE_THRESHOLD = -90;

function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

type QueueRowProps = {
  song: Song;
  index: number;
  currentIndex: number;
  queueLength: number;
  isCurrent: boolean;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
};

function QueueRow({
  song,
  index,
  currentIndex,
  queueLength,
  isCurrent,
  onSelect,
  onMove,
  onRemove,
}: QueueRowProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rowStartY = useSharedValue(0);
  const dragging = useSharedValue(false);
  const removed = useSharedValue(false);

  const commitMove = (from: number, to: number) => {
    if (to !== from) onMove(from, to);
  };
  const commitRemove = () => onRemove(index);

  const dragGesture = Gesture.Pan()
    .onStart(() => {
      dragging.value = true;
      rowStartY.value = 0;
      runOnJS(tap)();
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const requested = index + Math.round(e.translationY / ROW_HEIGHT);
      const target = Math.max(currentIndex + 1, Math.min(queueLength - 1, requested));
      translateY.value = withSpring(0, theme.motion.spring.snappy);
      dragging.value = false;
      runOnJS(commitMove)(index, target);
    });

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = Math.min(0, e.translationX);
    })
    .onEnd((e) => {
      if (translateX.value < REMOVE_THRESHOLD || e.velocityX < -800) {
        removed.value = true;
        translateX.value = withTiming(-400, { duration: theme.motion.duration.base }, (finished) => {
          if (finished) runOnJS(commitRemove)();
        });
      } else {
        translateX.value = withSpring(0, theme.motion.spring.snappy);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    opacity: removed.value ? 0 : 1,
    zIndex: dragging.value ? 2 : 0,
  }));

  return (
    <View style={styles.rowOuter}>
      <View style={styles.removeBackdrop}>
        <Ionicons name="trash-outline" size={18} color={theme.colors.textMuted} />
      </View>
      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={[styles.row, rowStyle]}>
          <Pressable
            testID={`queue-song-${index}`}
            onPress={() => {
              tap();
              onSelect(index);
            }}
            style={styles.rowPressable}
          >
            <AlbumCover source={song.artwork} size={44} />
            <View style={styles.info}>
              <Typography variant="caption" weight="bold" numberOfLines={1} letterSpacing={0.3}>
                {song.title?.toUpperCase()}
              </Typography>
              <Typography variant="tiny" color={theme.colors.textMuted} numberOfLines={1} style={{ marginTop: 3, letterSpacing: 0.8 }}>
                {song.artist?.toUpperCase()}
              </Typography>
            </View>
            <Pressable
              testID={`queue-remove-${index}`}
              onPress={() => {
                tap();
                onRemove(index);
              }}
              hitSlop={8}
              style={styles.iconTouchTarget}
            >
              <Ionicons name="close-circle-outline" size={20} color={theme.colors.textMuted} />
            </Pressable>
            <GestureDetector gesture={dragGesture}>
              <View style={styles.dragHandle} hitSlop={8}>
                <Ionicons name="reorder-three-outline" size={22} color={theme.colors.textMuted} />
              </View>
            </GestureDetector>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default function QueueScreen() {
  const router = useRouter();
  const current = usePlayer((s) => s.current);
  const queue = usePlayer((s) => s.queue);
  const queueIndex = usePlayer((s) => s.index);
  const playFromQueue = usePlayer((s) => s.playFromQueue);
  const moveQueueItem = usePlayer((s) => s.moveQueueItem);
  const removeQueueItem = usePlayer((s) => s.removeQueueItem);

  const dismiss = () => router.back();
  const upNext = queue.slice(queueIndex + 1);

  return (
    <Sheet onDismiss={dismiss} header={<QueueHeader onClose={dismiss} />}>
      <FlatList
        data={upNext}
        keyExtractor={(song, offset) => `${song.id}-${queueIndex + offset + 1}`}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          current ? (
            <View style={styles.nowPlayingSection}>
              <Typography variant="caption" weight="bold" color={theme.colors.textMuted} uppercase letterSpacing={1.5} style={{ marginBottom: theme.spacing.sm }}>
                Now Playing
              </Typography>
              <View style={styles.nowPlayingRow}>
                <AlbumCover source={current.artwork} size={44} />
                <View style={styles.info}>
                  <Typography variant="caption" weight="black" numberOfLines={1} letterSpacing={0.3}>
                    {current.title?.toUpperCase()}
                  </Typography>
                  <Typography variant="tiny" color={theme.colors.textMuted} numberOfLines={1} style={{ marginTop: 3, letterSpacing: 0.8 }}>
                    {current.artist?.toUpperCase()}
                  </Typography>
                </View>
                <View style={styles.nowPlayingMark} />
              </View>
              {upNext.length > 0 && (
                <Typography variant="caption" weight="bold" color={theme.colors.textMuted} uppercase letterSpacing={1.5} style={{ marginTop: theme.spacing.lg }}>
                  Up Next
                </Typography>
              )}
            </View>
          ) : null
        }
        renderItem={({ item, index: offset }) => {
          const actualIndex = queueIndex + offset + 1;
          return (
            <QueueRow
              song={item}
              index={actualIndex}
              currentIndex={queueIndex}
              queueLength={queue.length}
              isCurrent={false}
              onSelect={playFromQueue}
              onMove={moveQueueItem}
              onRemove={removeQueueItem}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-circle-outline" size={32} color={theme.colors.textMuted} />
            <Typography variant="bodySmall" color={theme.colors.textMuted} style={{ marginTop: theme.spacing.md }}>
              This is the last song in the queue
            </Typography>
          </View>
        }
      />
    </Sheet>
  );
}

function QueueHeader({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Typography variant="h4" weight="black" uppercase letterSpacing={1}>
        Queue
      </Typography>
      <Pressable testID="queue-close" onPress={onClose} hitSlop={12} style={styles.iconTouchTarget}>
        <Ionicons name="close" size={24} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  iconTouchTarget: { padding: theme.spacing.xs },

  listContent: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },

  nowPlayingSection: { marginBottom: theme.spacing.xs },
  nowPlayingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
  },
  nowPlayingMark: {
    width: 4,
    height: 28,
    backgroundColor: theme.colors.text,
    borderRadius: theme.radius.sm,
  },

  rowOuter: { height: ROW_HEIGHT, justifyContent: "center" },
  removeBackdrop: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    backgroundColor: theme.colors.background,
  },
  rowPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.thin,
    borderBottomColor: theme.colors.border,
  },
  info: { flex: 1, minWidth: 0 },
  dragHandle: { paddingLeft: theme.spacing.xs, paddingVertical: theme.spacing.xs },

  emptyWrap: { alignItems: "center", paddingVertical: theme.spacing.xxl },
});
