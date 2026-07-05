import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, Song, ArtistResult, AlbumResult } from '@/src/lib/api';
import { usePlayer } from '@/src/lib/player';
import { theme } from '@/src/theme';
import SongRow from '@/src/components/SongRow';
import { trackEvent } from '@/src/lib/analytics';

type Collection = {
  type: 'artist' | 'album';
  name: string;
  artist?: string | null;
  artwork?: string | null;
  songs: Song[];
};

export default function CollectionDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type: 'artist' | 'album'; name: string; artist?: string }>();
  const playQueue = usePlayer(state => state.playQueue);
  const [data, setData] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackEvent(params.type === 'artist' ? 'artist_opened' : 'album_opened', undefined, undefined, 0,
      { name: params.name, artist: params.artist }).catch(() => {});
    const load = async () => {
      setLoading(true);
      try {
        const path = params.type === 'album'
          ? `/catalog/album?title=${encodeURIComponent(params.name)}&artist=${encodeURIComponent(params.artist || '')}`
          : `/catalog/artist?name=${encodeURIComponent(params.name)}`;
        let collection = await api.get<Collection>(path);
        // External search results are not stored until played. If this
        // collection is not local yet, rebuild it from a read-only search.
        if (!collection.songs.length) {
          const search = await api.get<{ artists: ArtistResult[]; albums: AlbumResult[] }>(
            `/songs/search?q=${encodeURIComponent(params.name)}&limit=25`
          );
          if (params.type === 'artist') {
            const match = search.artists.find(item => item.name.toLowerCase() === params.name.toLowerCase());
            if (match) collection = { type: 'artist', name: match.name, artwork: match.artwork, songs: match.songs };
          } else {
            const match = search.albums.find(item => item.title.toLowerCase() === params.name.toLowerCase() && (!params.artist || item.artist.toLowerCase() === params.artist.toLowerCase()));
            if (match) collection = { type: 'album', name: match.title, artist: match.artist, artwork: match.artwork, songs: match.songs };
          }
        }
        setData(collection);
      } catch (error) {
        console.warn('Unable to load collection', error);
      } finally {
        setLoading(false);
      }
    };
    if (params.name) load();
  }, [params.type, params.name, params.artist]);

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}>
      <Pressable testID="collection-back" onPress={() => router.back()} hitSlop={10} style={styles.iconButton}>
        <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
      </Pressable>
    </View>
    {loading ? <ActivityIndicator color={theme.colors.brand} style={styles.loader} /> : data ? (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={data.artwork ? { uri: data.artwork } : undefined} style={[styles.artwork, data.type === 'artist' && styles.artistArtwork]} contentFit="cover" />
          <Text style={styles.kind}>{data.type.toUpperCase()}</Text>
          <Text style={styles.title}>{data.name}</Text>
          {data.type === 'album' && data.artist ? <Text style={styles.artist}>{data.artist}</Text> : null}
          <Text style={styles.count}>{data.songs.length} song{data.songs.length === 1 ? '' : 's'}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.playButton} disabled={!data.songs.length} onPress={() => playQueue(data.songs, 0, data.type)}>
              <Ionicons name="play" size={18} color="#fff" /><Text style={styles.playText}>Play all</Text>
            </Pressable>
            <Pressable style={styles.shuffleButton} disabled={!data.songs.length} onPress={() => playQueue(data.songs, Math.floor(Math.random() * data.songs.length), data.type)}>
              <Ionicons name="shuffle" size={19} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>
        {data.songs.length ? data.songs.map((song, index) => (
          <SongRow key={song.id} song={song} showAlbum={data.type === 'artist'} testIDPrefix="collection-song" onPress={() => playQueue(data.songs, index, data.type)} />
        )) : <View style={styles.empty}><Text style={styles.emptyText}>No songs found</Text></View>}
      </ScrollView>
    ) : <View style={styles.empty}><Text style={styles.emptyText}>Could not load this collection</Text></View>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm },
  iconButton: { padding: theme.spacing.sm, alignSelf: 'flex-start' },
  loader: { marginTop: 100 },
  content: { paddingBottom: 180 },
  hero: { alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  artwork: { width: 200, height: 200, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface2 },
  artistArtwork: { borderRadius: 100 },
  kind: { color: theme.colors.brandLight, fontSize: 11, fontWeight: '700', marginTop: theme.spacing.lg, letterSpacing: 1.2 },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: 5 },
  artist: { color: theme.colors.textSoft, fontSize: 14, marginTop: 5 },
  count: { color: theme.colors.textDim, fontSize: 12, marginTop: 5 },
  actions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
  playButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.brand, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md },
  playText: { color: '#fff', fontWeight: '600' },
  shuffleButton: { width: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.pill },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyText: { color: theme.colors.textDim },
});
