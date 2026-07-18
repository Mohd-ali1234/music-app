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
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlayer, formatTime } from "@/src/lib/player";

// Palette matched directly to the reference design (pure black / monochrome).
// Swap these for theme.colors.* if/when your theme file defines the same values.
const C = {
  bg: "#000000",
  card: "#151515",
  divider: "#242424",
  track: "#2B2B2D",
  border: "#333333",
  text: "#FFFFFF",
  textDim: "#8E8E93",
  textDim2: "#6E6E73",
};

export default function PlayerScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const current = usePlayer((s) => s.current);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const isLoading = usePlayer((s) => s.isLoading);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const volume = usePlayer((s) => (s as any).volume ?? 0.72);
  const setVolume = usePlayer((s) => (s as any).setVolume);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const seek = usePlayer((s) => s.seek);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const toggleLike = usePlayer((s) => s.toggleLike);
  const liked = usePlayer((s) =>
    current ? s.likedIds.has(current.id) : false,
  );
  const queue = usePlayer((s) => s.queue);
  const queueIndex = usePlayer((s) => s.index);
  const playFromQueue = usePlayer((s) => s.playFromQueue);

  if (!current) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: C.text, textAlign: "center", marginTop: 40 }}>
          No track playing
        </Text>
      </SafeAreaView>
    );
  }

  const progress = duration > 0 ? position / duration : 0;
  const upNext = queue.slice(queueIndex + 1);

  const onSeekTap = (e: any) => {
    const { locationX } = e.nativeEvent;
    e.target?.measure?.((_x: number, _y: number, w: number) => {
      if (w && duration) seek((locationX / w) * duration);
    });
  };
  const onVolumeTap = (e: any) => {
    const { locationX } = e.nativeEvent;
    e.target?.measure?.((_x: number, _y: number, w: number) => {
      if (w && setVolume) setVolume(Math.min(Math.max(locationX / w, 0), 1));
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="player-close"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.headerBtn}
        >
          <Ionicons name="chevron-down" size={26} color={C.text} />
        </Pressable>
        <Pressable testID="player-more" hitSlop={12} style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={C.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, isWide && styles.bodyWide]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.playerGrid, isWide && styles.playerGridWide]}>
          {/* Artwork */}
          <View style={[styles.artColumn, isWide && styles.artColumnWide]}>
            <View style={[styles.artWrap, isWide && styles.artWrapWide]}>
              <Image
                source={current.artwork ? { uri: current.artwork } : undefined}
                style={styles.art}
                contentFit="cover"
              />
              {isLoading && (
                <View style={styles.loadOverlay}>
                  <ActivityIndicator color={C.text} />
                </View>
              )}
            </View>
          </View>

          <View
            style={[styles.detailsColumn, isWide && styles.detailsColumnWide]}
          >
            {/* Title + like */}
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.songTitle} numberOfLines={1}>
                  {current.title?.toUpperCase()}
                </Text>
                <Text style={styles.songArtist} numberOfLines={1}>
                  {current.artist?.toUpperCase()}
                </Text>
              </View>
              <Pressable
                testID="player-like-btn"
                onPress={() => toggleLike(current.id)}
                hitSlop={10}
              >
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={26}
                  color={liked ? C.text : C.textDim}
                />
              </Pressable>
            </View>

            {/* Progress */}
            <View style={styles.progress}>
              <Pressable
                onPress={onSeekTap}
                style={styles.progressTrack}
                testID="seek-bar"
              >
                <View
                  style={[styles.progressFill, { width: `${progress * 100}%` }]}
                />
              </Pressable>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Text style={styles.timeText}>
                  {formatTime(duration || current.duration)}
                </Text>
              </View>
            </View>

            {/* Transport controls */}
            <View style={styles.controls}>
              <Pressable
                testID="shuffle-btn"
                onPress={toggleShuffle}
                hitSlop={10}
              >
                <Ionicons
                  name="shuffle"
                  size={22}
                  color={shuffle ? C.text : C.textDim}
                />
              </Pressable>
              <Pressable testID="prev-btn" onPress={prev} hitSlop={10}>
                <Ionicons name="play-skip-back" size={28} color={C.text} />
              </Pressable>
              <Pressable
                testID="play-pause-btn"
                onPress={togglePlay}
                style={styles.playBig}
              >
                {isLoading ? (
                  <ActivityIndicator color={C.bg} />
                ) : (
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={26}
                    color={C.bg}
                  />
                )}
              </Pressable>
              <Pressable testID="next-btn" onPress={next} hitSlop={10}>
                <Ionicons name="play-skip-forward" size={28} color={C.text} />
              </Pressable>
              <Pressable testID="repeat-btn" onPress={cycleRepeat} hitSlop={10}>
                <Ionicons
                  name="repeat"
                  size={22}
                  color={repeat !== "off" ? C.text : C.textDim}
                />
                {repeat === "one" && (
                  <View style={styles.repeatDot}>
                    <Text
                      style={{ color: C.bg, fontSize: 8, fontWeight: "700" }}
                    >
                      1
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Volume */}
            <View style={styles.volumeRow}>
              <Ionicons name="volume-low-outline" size={15} color={C.textDim} />
              <Pressable
                onPress={onVolumeTap}
                style={styles.volumeTrack}
                testID="volume-bar"
              >
                <View
                  style={[styles.volumeFill, { width: `${volume * 100}%` }]}
                />
              </Pressable>
              <Ionicons
                name="volume-high-outline"
                size={17}
                color={C.textDim}
              />
            </View>
          </View>
        </View>

        {/* Up Next card */}
        <View style={[styles.queueCard, isWide && styles.queueCardWide]}>
          <Text style={styles.queueTitle}>UP NEXT</Text>

          {upNext.length ? (
            upNext.map((song, offset) => {
              const actualIndex = queueIndex + offset + 1;
              const isLast = offset === upNext.length - 1;
              return (
                <Pressable
                  key={`${song.id}-${actualIndex}`}
                  testID={`queue-song-${actualIndex}`}
                  onPress={() => playFromQueue(actualIndex)}
                  style={({ pressed }) => [
                    styles.queueRow,
                    !isLast && styles.queueRowDivider,
                    pressed && styles.queueRowPressed,
                  ]}
                >
                  <View style={styles.queueNumberBadge}>
                    <Text style={styles.queueNumberText}>
                      {String(actualIndex + 1).padStart(2, "0")}
                    </Text>
                  </View>
                  <View style={styles.queueInfo}>
                    <Text style={styles.queueSongTitle} numberOfLines={1}>
                      {song.title?.toUpperCase()}
                    </Text>
                    <Text style={styles.queueArtist} numberOfLines={1}>
                      {song.artist?.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.queueDuration}>
                    {formatTime(song.duration)}
                  </Text>
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={18}
                    color={C.textDim}
                  />
                </Pressable>
              );
            })
          ) : (
            <View style={styles.queueEmpty}>
              <Ionicons
                name="checkmark-circle-outline"
                size={26}
                color={C.textDim}
              />
              <Text style={styles.queueEmptyText}>
                This is the last song in the queue
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerBtn: { padding: 6 },

  body: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
  },
  bodyWide: { paddingHorizontal: 48 },

  playerGrid: { width: "100%" },
  playerGridWide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 56,
    paddingTop: 24,
  },
  artColumn: { width: "100%" },
  artColumnWide: { width: "46%", maxWidth: 480 },
  detailsColumn: { width: "100%" },
  detailsColumnWide: { flex: 1 },

  artWrap: {
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    marginTop: 16,
    backgroundColor: C.card,
    position: "relative",
  },
  artWrapWide: {
    marginTop: 0,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
  },
  art: { width: "100%", height: "100%" },
  loadOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 26,
    gap: 12,
  },
  songTitle: {
    color: C.text,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  songArtist: {
    color: C.textDim,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
    letterSpacing: 1.1,
  },

  progress: { marginTop: 22 },
  progressTrack: {
    height: 4,
    backgroundColor: C.track,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: C.text,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timeText: { color: C.textDim, fontSize: 11, fontVariant: ["tabular-nums"] },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    paddingHorizontal: 2,
  },
  playBig: {
    width: 66,
    height: 66,
    borderRadius: 18,
    backgroundColor: C.text,
    alignItems: "center",
    justifyContent: "center",
  },
  repeatDot: {
    position: "absolute",
    top: -6,
    right: -8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.text,
    alignItems: "center",
    justifyContent: "center",
  },

  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
  },
  volumeTrack: {
    flex: 1,
    height: 4,
    backgroundColor: C.track,
    borderRadius: 2,
    overflow: "hidden",
  },
  volumeFill: {
    height: "100%",
    backgroundColor: C.textDim2,
    borderRadius: 2,
  },

  queueCard: {
    marginTop: 28,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
  },
  queueCardWide: { marginTop: 48 },
  queueTitle: {
    color: C.textDim,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 14,
  },

  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  queueRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.divider,
  },
  queueRowPressed: { opacity: 0.6 },

  queueNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  queueNumberText: {
    color: C.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
  queueInfo: { flex: 1, minWidth: 0 },
  queueSongTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  queueArtist: {
    color: C.textDim,
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 0.8,
  },
  queueDuration: { color: C.textDim, fontSize: 12, marginRight: 4 },

  queueEmpty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 28,
  },
  queueEmptyText: { color: C.textDim, fontSize: 13 },
});
