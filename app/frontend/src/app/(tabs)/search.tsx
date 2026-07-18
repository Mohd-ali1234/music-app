// Action: file_editor create /app/frontend/src/app/(tabs)/search.tsx --file-text "
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { api, Song, ArtistResult, AlbumResult } from "@/src/lib/api";
import { usePlayer } from "@/src/lib/player";
import SongRow from "@/src/components/SongRow";
import { BrutalHeading, BrutalLabel } from "@/src/components/brutal/BrutalText";

const CATEGORIES: { key: string; label: string; icon: any }[] = [
  { key: "artists", label: "ARTISTS", icon: "person-outline" },
  { key: "albums", label: "ALBUMS", icon: "disc-outline" },
  { key: "songs", label: "SONGS", icon: "musical-note-outline" },
  { key: "playlists", label: "PLAYLISTS", icon: "list-outline" },
  { key: "genres", label: "GENRES", icon: "radio-outline" },
  { key: "podcasts", label: "PODCASTS", icon: "mic-outline" },
];

export default function Search() {
  const router = useRouter();
  const playQueue = usePlayer((s) => s.playQueue);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [artists, setArtists] = useState<ArtistResult[]>([]);
  const [albums, setAlbums] = useState<AlbumResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [searchId, setSearchId] = useState<string | null>(null);
  const debounceRef = useRef<any>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      requestRef.current++;
      setLoading(false);
      setResults([]);
      setArtists([]);
      setAlbums([]);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(q.trim()), 500);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [q]);

  const doSearch = async (query: string) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    try {
      const res = await api.get<any>(
        `/songs/search?q=${encodeURIComponent(query)}`,
      );
      if (requestId !== requestRef.current) return;
      const songs = Array.isArray(res.songs)
        ? res.songs
        : Array.isArray(res.results)
          ? res.results
          : [];
      setResults(songs);
      setArtists(
        (Array.isArray(res.artists) ? res.artists : []).map((artist: any) => ({
          ...artist,
          artwork: artist.artwork ?? artist.artwork_url,
          songs: Array.isArray(artist.songs)
            ? artist.songs
            : songs.filter((song: Song) => song.artist === artist.name),
        })),
      );
      setAlbums(
        (Array.isArray(res.albums) ? res.albums : []).map((album: any) => ({
          ...album,
          title: album.title ?? album.name ?? "Unknown album",
          artwork: album.artwork ?? album.artwork_url,
        })),
      );
      setSearchId(res.search_id);
      setRecents((prev) =>
        [query, ...prev.filter((p) => p !== query)].slice(0, 5),
      );
    } catch {
      if (requestId === requestRef.current) {
        setResults([]);
        setArtists([]);
        setAlbums([]);
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  };

  const clearRecents = () => setRecents([]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <BrutalHeading size="lg">SEARCH</BrutalHeading>
      </View>

      <View style={styles.searchBar}>
        <Ionicons
          name="search-outline"
          size={18}
          color={theme.colors.textMuted}
        />
        <TextInput
          testID="search-input"
          value={q}
          onChangeText={setQ}
          placeholder="Search artists, songs, albums..."
          placeholderTextColor={theme.colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {q.length > 0 && (
          <Pressable
            testID="search-clear"
            onPress={() => setQ("")}
            hitSlop={12}
          >
            <Ionicons name="close" size={18} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {q.trim().length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <BrutalLabel style={styles.blockLabel}>BROWSE</BrutalLabel>
          <View style={styles.grid}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                testID={`cat-${c.key}`}
                onPress={() => setQ(c.label)}
                style={styles.gridItem}
              >
                <Text style={styles.gridLabel}>{c.label}</Text>
                <Ionicons name={c.icon} size={18} color={theme.colors.text} />
              </Pressable>
            ))}
          </View>

          {recents.length > 0 && (
            <View style={styles.recentSection}>
              <View style={styles.recentHead}>
                <BrutalLabel>RECENT SEARCHES</BrutalLabel>
                <Pressable testID="clear-recent-btn" onPress={clearRecents}>
                  <BrutalLabel color={theme.colors.text}>CLEAR</BrutalLabel>
                </Pressable>
              </View>
              <View style={styles.recentList}>
                {recents.map((r, i) => (
                  <Pressable
                    key={`${r}-${i}`}
                    testID={`chip-recent-${i}`}
                    onPress={() => setQ(r)}
                    style={styles.recentRow}
                  >
                    <Text style={styles.recentText}>{r.toUpperCase()}</Text>
                    <Ionicons
                      name="close"
                      size={14}
                      color={theme.colors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <View style={{ height: 120 }} />
        </ScrollView>
      ) : loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.text} size="large" />
        </View>
      ) : (
        <ScrollView
          testID="search-results-list"
          contentContainerStyle={{ paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
        >
          {artists.length > 0 && (
            <View style={styles.resSection}>
              <BrutalLabel style={styles.blockLabel}>ARTISTS</BrutalLabel>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hRow}
              >
                {artists.map((a) => (
                  <Pressable
                    key={a.name.toLowerCase()}
                    onPress={() =>
                      router.push({
                        pathname: "/collection",
                        params: { type: "artist", name: a.name },
                      })
                    }
                    style={styles.hCard}
                  >
                    <Image
                      source={a.artwork ? { uri: a.artwork } : undefined}
                      style={styles.hArt}
                      contentFit="cover"
                    />
                    <Text style={styles.hTitle} numberOfLines={1}>
                      {a.name.toUpperCase()}
                    </Text>
                    <Text style={styles.hMeta}>{a.songs?.length ?? 0} SONGS</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          {albums.length > 0 && (
            <View style={styles.resSection}>
              <BrutalLabel style={styles.blockLabel}>ALBUMS</BrutalLabel>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hRow}
              >
                {albums.map((al) => (
                  <Pressable
                    key={`${al.title}-${al.artist}`}
                    onPress={() =>
                      router.push({
                        pathname: "/collection",
                        params: {
                          type: "album",
                          name: al.title,
                          artist: al.artist,
                        },
                      })
                    }
                    style={styles.hCard}
                  >
                    <Image
                      source={al.artwork ? { uri: al.artwork } : undefined}
                      style={styles.hArt}
                      contentFit="cover"
                    />
                    <Text style={styles.hTitle} numberOfLines={1}>
                      {al.title.toUpperCase()}
                    </Text>
                    <Text style={styles.hMeta}>{al.artist.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          {results.length > 0 && (
            <>
              <BrutalLabel
                style={[
                  styles.blockLabel,
                  { paddingHorizontal: 20, marginTop: 8, marginBottom: 12 },
                ]}
              >
                SONGS
              </BrutalLabel>
              {results.map((song, index) => (
                <SongRow
                  key={song.id}
                  song={song}
                  showAlbum
                  testIDPrefix="search-result"
                  onPress={() =>
                    playQueue(results, index, {
                      source: "search",
                      searchId: searchId ?? undefined,
                      selectedPosition: index,
                    })
                  }
                />
              ))}
            </>
          )}
          {results.length === 0 &&
            artists.length === 0 &&
            albums.length === 0 && (
              <View style={styles.empty}>
                <Ionicons
                  name="close-outline"
                  size={48}
                  color={theme.colors.textMuted}
                />
                <BrutalLabel style={{ marginTop: 12 }}>
                  NO RESULTS FOUND
                </BrutalLabel>
              </View>
            )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  scroll: { paddingHorizontal: 20 },
  blockLabel: { marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridItem: {
    width: "48.5%",
    minHeight: 60,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gridLabel: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  recentSection: { marginTop: 36 },
  recentHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  recentList: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  recentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  recentText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  resSection: { marginBottom: 24 },
  hRow: { gap: 12, paddingHorizontal: 20 },
  hCard: { width: 132 },
  hArt: { width: 132, height: 132, backgroundColor: theme.colors.secondary },
  hTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 8,
  },
  hMeta: {
    color: theme.colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 3,
    fontWeight: "600",
  },
  empty: { alignItems: "center", paddingVertical: 100 },
});
