import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { api, Song, ArtistResult, AlbumResult } from '@/src/lib/api';
import { usePlayer } from '@/src/lib/player';
import { theme } from '@/src/theme';
import SongRow from '@/src/components/SongRow';
import { Skeleton } from '@/src/components/ui';

function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

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
    const load = async () => {
      setLoading(true);
      try {
        const search = await api.get<{ songs?: Song[] }>(
          `/songs/search?q=${encodeURIComponent(params.name)}`,
        );
        const songs = Array.isArray(search.songs) ? search.songs : [];
        const matchingSongs = songs.filter((song) =>
          params.type === 'artist'
            ? song.artist.toLowerCase() === params.name.toLowerCase()
            : song.album?.toLowerCase() === params.name.toLowerCase() &&
              (!params.artist || song.artist.toLowerCase() === params.artist.toLowerCase()),
        );
        const first = matchingSongs[0];
        setData({
          type: params.type,
          name: params.name,
          artist: params.artist,
          artwork: first?.artwork,
          songs: matchingSongs,
        });
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
    {loading ? (
      <View style={styles.content}>
        <View style={styles.hero}>
          <Skeleton width={200} height={200} radius={theme.radius.lg} />
          <Skeleton width={140} height={22} style={{ marginTop: theme.spacing.lg }} />
          <Skeleton width={90} height={12} style={{ marginTop: theme.spacing.sm }} />
        </View>
        <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={44} radius={theme.radius.md} />
          ))}
        </View>
      </View>
    ) : data ? (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={data.artwork ? { uri: data.artwork } : undefined} style={[styles.artwork, data.type === 'artist' && styles.artistArtwork]} contentFit="cover" />
          <Text style={styles.kind}>{data.type.toUpperCase()}</Text>
          <Text style={styles.title}>{data.name}</Text>
          {data.type === 'album' && data.artist ? <Text style={styles.artist}>{data.artist}</Text> : null}
          <Text style={styles.count}>{data.songs.length} song{data.songs.length === 1 ? '' : 's'}</Text>
          <View style={styles.actions}>
            <Pressable
              style={styles.playButton}
              disabled={!data.songs.length}
              onPress={() => {
                tap();
                playQueue(data.songs, 0, data.type);
              }}
            >
              <Ionicons name="play" size={18} color={theme.colors.background} /><Text style={styles.playText}>Play all</Text>
            </Pressable>
            <Pressable
              style={styles.shuffleButton}
              disabled={!data.songs.length}
              onPress={() => {
                tap();
                playQueue(data.songs, Math.floor(Math.random() * data.songs.length), data.type);
              }}
            >
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
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm },
  iconButton: { padding: theme.spacing.sm, alignSelf: 'flex-start' },
  content: { paddingBottom: 180 },
  hero: { alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  artwork: { width: 200, height: 200, borderRadius: theme.radius.lg, backgroundColor: theme.colors.secondary },
  artistArtwork: { borderRadius: 100 },
  kind: { color: theme.colors.accent, fontSize: 11, fontWeight: '700', marginTop: theme.spacing.lg, letterSpacing: 1.2 },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: 5 },
  artist: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 5 },
  count: { color: theme.colors.textMuted, fontSize: 12, marginTop: 5 },
  actions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
  playButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.text, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md },
  playText: { color: theme.colors.background, fontWeight: '600' },
  shuffleButton: { width: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderRadius: theme.radius.pill },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyText: { color: theme.colors.textMuted },
});
