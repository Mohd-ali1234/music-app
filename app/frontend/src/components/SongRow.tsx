import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { theme } from "@/src/theme";
import { Song } from "@/src/lib/api";
import { usePlayer } from "@/src/lib/player";

type Props = {
  song: Song;
  onPress?: () => void;
  onRemove?: () => void;
  showAlbum?: boolean;
  testIDPrefix?: string;
  index?: number;
};

export default function SongRow({
  song,
  onPress,
  onRemove,
  showAlbum,
  testIDPrefix = "song-row",
  index,
}: Props) {
  const liked = usePlayer((s) => s.likedIds.has(song.id));
  const toggleLike = usePlayer((s) => s.toggleLike);
  const current = usePlayer((s) => s.current);
  const isCurrent = current?.id === song.id;
  const isExternal = song.id?.startsWith("external:") ?? false;
  const duration = formatDuration(song.duration);

  return (
    <Pressable
      testID={`${testIDPrefix}-${song.id}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.colors.secondary },
      ]}
    >
      {typeof index === "number" ? (
        <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
      ) : (
        <Image
          source={song.artwork ? { uri: song.artwork } : undefined}
          style={styles.art}
          contentFit="cover"
        />
      )}
      <View style={styles.info}>
        <Text
          style={[styles.title, isCurrent && { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {song.title.toUpperCase()}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {song.artist.toUpperCase()}
          {showAlbum && song.album ? ` · ${song.album.toUpperCase()}` : ""}
        </Text>
      </View>
      <Text style={styles.duration}>{duration}</Text>
      {!isExternal && (
        <Pressable
          testID={`like-btn-${song.id}`}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            toggleLike(song.id);
          }}
          hitSlop={10}
          style={styles.iconBtn}
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={16}
            color={liked ? theme.colors.text : theme.colors.textMuted}
          />
        </Pressable>
      )}
      {onRemove && (
        <Pressable
          testID={`remove-btn-${song.id}`}
          onPress={(e) => {
            e.stopPropagation();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onRemove();
          }}
          hitSlop={10}
          style={styles.iconBtn}
        >
          <Ionicons name="close-circle-outline" size={18} color={theme.colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
}

function formatDuration(sec: number) {
  if (!sec || Number.isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  index: {
    width: 28,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },
  art: { width: 44, height: 44, backgroundColor: theme.colors.secondary, borderRadius: theme.radius.md },
  info: { flex: 1, minWidth: 0 },
  title: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  duration: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },
  iconBtn: { padding: 4 },
});
