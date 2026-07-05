import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/src/theme';
import { api, Song, ArtistResult, AlbumResult } from '@/src/lib/api';
import { usePlayer } from '@/src/lib/player';
import SongRow from '@/src/components/SongRow';

const TRENDING = ['Dua Lipa', 'The Weeknd', 'Harry Styles', 'Billie Eilish', 'Taylor Swift'];

export default function Search() {
  const router = useRouter();
  const playQueue = usePlayer(s => s.playQueue);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [artists, setArtists] = useState<ArtistResult[]>([]);
  const [albums, setAlbums] = useState<AlbumResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [source, setSource] = useState<'local' | 'external' | null>(null);
  const [searchId, setSearchId] = useState<string | null>(null);
  const debounceRef = useRef<any>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { requestRef.current++; setLoading(false); setResults([]); setArtists([]); setAlbums([]); setSource(null); return; }
    debounceRef.current = setTimeout(() => doSearch(q.trim()), 450);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [q]);

  const doSearch = async (query: string) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    try {
      const res = await api.get<{ source: 'merged'; search_id: string; results: Song[]; songs?: Song[]; artists?: ArtistResult[]; albums?: AlbumResult[] }>(`/songs/search?q=${encodeURIComponent(query)}`);
      if (requestId !== requestRef.current) return;
      setResults(res.songs || res.results || []);
      setArtists(res.artists || []);
      setAlbums(res.albums || []);
      setSource(res.source);
      setSearchId(res.search_id);
      setRecents(prev => [query, ...prev.filter(p => p !== query)].slice(0, 5));
    } catch (e: any) {
      if (requestId === requestRef.current) { setResults([]); setArtists([]); setAlbums([]); }
    } finally { if (requestId === requestRef.current) setLoading(false); }
  };

  const clearRecents = () => setRecents([]);

  const chip = (label: string, onPress: () => void, key: string) => (
    <Pressable key={key} testID={`chip-${key}`} onPress={onPress} style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.colors.textDim} />
          <TextInput
            testID="search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search songs, artists, albums..."
            placeholderTextColor={theme.colors.textDim}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable testID="search-clear" onPress={() => setQ('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textDim} />
            </Pressable>
          )}
        </View>
      </View>

      {q.trim().length === 0 ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {recents.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                <Pressable testID="clear-recent-btn" onPress={clearRecents}>
                  <Text style={styles.clearLink}>Clear</Text>
                </Pressable>
              </View>
              <View style={styles.chips}>
                {recents.map((r, i) => chip(r, () => setQ(r), `recent-${i}`))}
              </View>
            </View>
          )}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Trending Searches</Text>
            </View>
            <View style={styles.chips}>
              {TRENDING.map((t, i) => chip(t, () => setQ(t), `trend-${i}`))}
            </View>
          </View>
          <View style={{ height: 160 }} />
        </ScrollView>
      ) : loading ? (
        <View style={styles.loading}><ActivityIndicator color={theme.colors.brand} /></View>
      ) : (
        <>
          <View style={styles.resultHead}>
            <Text style={styles.sectionTitle}>Top Results</Text>
            {source === 'external' && (
              <View testID="ingest-badge" style={styles.ingestBadge}>
                <Ionicons name="cloud-download-outline" size={12} color={theme.colors.brand} />
                <Text style={styles.ingestText}>Fresh from catalog</Text>
              </View>
            )}
          </View>
          <ScrollView testID="search-results-list" contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
            {artists.length > 0 && <ResultCarousel title="Artists">
              {artists.map(artist => <ResultCard key={artist.name.toLowerCase()} title={artist.name} subtitle={`${artist.songs.length} song${artist.songs.length === 1 ? '' : 's'}`} artwork={artist.artwork} round onPress={() => router.push({ pathname: '/collection', params: { type: 'artist', name: artist.name } })} />)}
            </ResultCarousel>}
            {albums.length > 0 && <ResultCarousel title="Albums">
              {albums.map(album => <ResultCard key={`${album.title}-${album.artist}`.toLowerCase()} title={album.title} subtitle={album.artist} artwork={album.artwork} onPress={() => router.push({ pathname: '/collection', params: { type: 'album', name: album.title, artist: album.artist } })} />)}
            </ResultCarousel>}
            {results.length > 0 && <Text style={styles.listTitle}>Songs</Text>}
            {results.map((song, index) => <SongRow key={song.id} song={song} showAlbum testIDPrefix="search-result" onPress={() => playQueue(results, index, { source: 'search', searchId: searchId ?? undefined, selectedPosition: index })} />)}
            {results.length === 0 && artists.length === 0 && albums.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="musical-notes-outline" size={40} color={theme.colors.textDim} />
                <Text style={styles.emptyText}>No results found</Text>
              </View>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

function ResultCarousel({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.resultSection}>
    <Text style={styles.listTitle}>{title}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>{children}</ScrollView>
  </View>;
}

function ResultCard({ title, subtitle, artwork, round, onPress }: { title: string; subtitle: string; artwork?: string | null; round?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
    <Image source={artwork ? { uri: artwork } : undefined} style={[styles.cardArt, round && styles.roundArt]} contentFit="cover" />
    <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
    <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.md },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 14 },
  scroll: { paddingHorizontal: theme.spacing.lg },
  section: { marginBottom: theme.spacing.xl },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  clearLink: { color: theme.colors.brandLight, fontSize: 13, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  chipText: { color: theme.colors.textSoft, fontSize: 13 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  resultHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
  },
  ingestBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing.md, paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  ingestText: { color: theme.colors.brand, fontSize: 11, fontWeight: '500' },
  resultSection: { marginBottom: theme.spacing.lg },
  listTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600', marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md },
  cards: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  card: { width: 116 },
  cardArt: { width: 116, height: 116, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface2 },
  roundArt: { borderRadius: 58 },
  cardTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '600', marginTop: theme.spacing.sm },
  cardSubtitle: { color: theme.colors.textDim, fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: theme.spacing.md },
  emptyText: { color: theme.colors.textDim, fontSize: 14 },
});
