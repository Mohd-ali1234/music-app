import React from "react";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/src/lib/api";
import { theme } from "@/src/theme";

type Album = { title: string; artist: string; artwork?: string; songs: Song[] };

export type DashboardFeed = {
  most_played?: Song[];
  recently_played?: Song[];
  made_for_you?: Song[];
  recommended_albums?: Album[];
  quick_picks?: Song[];
  forgotten_favorites?: Song[];
  top_artists?: { name: string; play_count: number }[];
  favorite_genres?: string[];
  listening_stats?: { plays: number; unique_songs: number; minutes: number };
};

function SongRail({
  title,
  songs = [],
  onPlay,
}: {
  title: string;
  songs?: Song[];
  onPlay: (songs: Song[], index: number) => void;
}) {
  if (!songs.length) return null;
  return (
    <View style={s.section}>
      <Text style={s.label}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        {songs.slice(0, 10).map((song, index) => (
          <Pressable key={`${song.id}-${index}`} onPress={() => onPlay(songs, index)} style={s.card}>
            <Image source={song.artwork ? { uri: song.artwork } : undefined} style={s.art} contentFit="cover" />
            <Text style={s.song} numberOfLines={1}>{song.title.toUpperCase()}</Text>
            <Text style={s.artist} numberOfLines={1}>{song.artist.toUpperCase()}</Text>
            <View style={s.play}>
              <Ionicons name="play" size={11} color={theme.colors.background} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function PersonalizedSections({
  feed,
  onPlay,
}: {
  feed: DashboardFeed;
  onPlay: (songs: Song[], index: number) => void;
}) {
  const stats = feed.listening_stats;
  const statTiles: [string, number][] = [
    ["PLAYS", stats?.plays ?? 0],
    ["MINUTES", Math.round(stats?.minutes ?? 0)],
    ["DISCOVERED", stats?.unique_songs ?? 0],
  ];

  return (
    <>
      <View style={s.stats}>
        {statTiles.map(([label, value]) => (
          <View key={label} style={s.stat}>
            <Text style={s.statValue}>{value}</Text>
            <Text style={s.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <SongRail title="MOST PLAYED" songs={feed.most_played} onPlay={onPlay} />
      {/* "Recently Played" is already shown by the Home screen itself — not repeated here. */}
      <SongRail title="SONGS YOU MAY LIKE" songs={feed.made_for_you} onPlay={onPlay} />
      <SongRail title="QUICK PICKS" songs={feed.quick_picks} onPlay={onPlay} />
      <SongRail title="FORGOTTEN FAVORITES" songs={feed.forgotten_favorites} onPlay={onPlay} />

      {!!feed.recommended_albums?.length && (
        <View style={s.section}>
          <Text style={s.label}>RECOMMENDED ALBUMS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
            {feed.recommended_albums.map((album) => (
              <Pressable
                key={`${album.title}-${album.artist}`}
                style={s.card}
                onPress={() => onPlay(album.songs, 0)}
              >
                <Image source={album.artwork ? { uri: album.artwork } : undefined} style={s.art} contentFit="cover" />
                <Text style={s.song} numberOfLines={1}>{album.title.toUpperCase()}</Text>
                <Text style={s.artist} numberOfLines={1}>{album.artist.toUpperCase()}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {!!feed.top_artists?.length && (
        <View style={s.section}>
          <Text style={s.label}>FAVORITE ARTISTS</Text>
          <View style={s.chips}>
            {feed.top_artists.map((a) => (
              <View key={a.name} style={s.chip}>
                <Text style={s.chipText}>{a.name.toUpperCase()}</Text>
                <Text style={s.chipSub}>{a.play_count} PLAYS</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {!!feed.favorite_genres?.length && (
        <View style={s.section}>
          <Text style={s.label}>FAVORITE GENRES</Text>
          <View style={s.chips}>
            {feed.favorite_genres.map((g) => (
              <View key={g} style={s.genre}>
                <Text style={s.genreText}>{g.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  stats: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    flexDirection: "row",
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },
  stat: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRightWidth: theme.borderWidth.thin,
    borderRightColor: theme.colors.border,
  },
  statValue: { color: theme.colors.text, fontSize: 22, fontWeight: "900" },
  statLabel: { color: theme.colors.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 1.3, marginTop: 4 },

  section: { marginBottom: theme.spacing.xl, paddingLeft: theme.spacing.lg },
  label: { color: theme.colors.text, fontSize: 11, fontWeight: "900", letterSpacing: 1.8, marginBottom: 13 },
  rail: { gap: theme.spacing.md, paddingRight: theme.spacing.lg },
  card: { width: 128, position: "relative" },
  art: { width: 128, height: 128, backgroundColor: theme.colors.secondary, borderRadius: theme.radius.md },
  song: { color: theme.colors.text, fontSize: 11, fontWeight: "800", letterSpacing: 0.6, marginTop: 9 },
  artist: { color: theme.colors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.7, marginTop: 4 },
  play: {
    position: "absolute",
    right: 7,
    top: 100,
    width: 22,
    height: 22,
    backgroundColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, paddingRight: theme.spacing.lg },
  chip: { borderWidth: theme.borderWidth.thin, borderColor: theme.colors.border, padding: 10, minWidth: 120, borderRadius: theme.radius.md },
  chipText: { color: theme.colors.text, fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  chipSub: { color: theme.colors.textMuted, fontSize: 9, marginTop: 4, letterSpacing: 0.8 },
  genre: { backgroundColor: theme.colors.text, paddingHorizontal: 12, paddingVertical: 10, borderRadius: theme.radius.md },
  genreText: { color: theme.colors.background, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
});
