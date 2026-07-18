// Action: file_editor create /app/frontend/src/components/MiniPlayer.tsx --file-text "
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlayer } from "@/src/lib/player";
import { theme } from "@/src/theme";

export default function MiniPlayer() {
  const router = useRouter();
  const current = usePlayer((s) => s.current);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const togglePlay = usePlayer((s) => s.togglePlay);

  if (!current) return null;
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <Pressable
      testID="mini-player"
      onPress={() => router.push("/player")}
      style={styles.wrap}
    >
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.row}>
        <Image
          source={current.artwork ? { uri: current.artwork } : undefined}
          style={styles.art}
          contentFit="cover"
        />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {(current.title || "Unknown title").toUpperCase()}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {(current.artist || "Unknown artist").toUpperCase()}
          </Text>
        </View>
        <Pressable
          testID="mini-player-play-pause"
          onPress={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          hitSlop={12}
          style={styles.playBtn}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={20}
            color={theme.colors.text}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  progressTrack: {
    height: 2,
    backgroundColor: theme.colors.secondary,
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 12,
  },
  art: { width: 40, height: 40, backgroundColor: theme.colors.secondary },
  info: { flex: 1 },
  title: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
  },
  artist: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 1.5,
  },
  playBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
  },
});
// "
// Observation: Overwrite successful: /app/frontend/src/components/MiniPlayer.tsx
