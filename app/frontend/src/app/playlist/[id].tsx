import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '@/src/theme';
import { api, Song } from '@/src/lib/api';
import { usePlayer } from '@/src/lib/player';
import SongRow from '@/src/components/SongRow';

export default function PlaylistDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isLiked = id === 'liked';
  const playQueue = usePlayer(s => s.playQueue);

  const [data, setData] = useState<{ name: string; cover?: string | null; description?: string; tracks: Song[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      if (isLiked) {
        const { songs: tracks = [] } = await api.get<{ songs?: Song[] }>('/library/likes');
        setData({ name: 'Liked Songs', description: 'Songs you love', tracks, cover: tracks[0]?.artwork });
      } else {
        const { playlist } = await api.get<{ playlist: any }>(`/playlists/${id}`);
        setData({ name: playlist.name, description: playlist.description, cover: playlist.cover, tracks: playlist.songs || [] });
      }
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, [id, isLiked]);

  useEffect(() => { load(); }, [load]);

  const play = (index: number) => {
    if (!data?.tracks?.length) return;
    playQueue(data.tracks, index, 'playlist');
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Pressable testID="playlist-more" hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBlock}>
          {data.cover ? (
            <Image source={{ uri: data.cover }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, { backgroundColor: isLiked ? theme.colors.liked + '30' : theme.colors.brandDark, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name={isLiked ? 'heart' : 'musical-notes'} size={48} color={isLiked ? theme.colors.liked : theme.colors.brandLight} />
            </View>
          )}
          <Text style={styles.title}>{data.name}</Text>
          {data.description ? <Text style={styles.desc}>{data.description}</Text> : null}
          <Text style={styles.meta}>{data.tracks.length} songs</Text>

          <View style={styles.actions}>
            <Pressable
              testID="play-playlist-btn"
              onPress={() => play(0)}
              style={[styles.actionBtn, { backgroundColor: theme.colors.brand, paddingHorizontal: theme.spacing.xl }]}
              disabled={data.tracks.length === 0}
            >
              <Ionicons name="play" size={18} color="#FFF" />
              <Text style={styles.actionText}>Play</Text>
            </Pressable>
            <Pressable
              testID="shuffle-playlist-btn"
              onPress={() => { if (data.tracks.length) play(Math.floor(Math.random() * data.tracks.length)); }}
              style={[styles.actionBtn, { backgroundColor: theme.colors.surface }]}
            >
              <Ionicons name="shuffle" size={18} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>

        {data.tracks.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="musical-notes-outline" size={42} color={theme.colors.textDim} />
            <Text style={styles.emptyText}>{isLiked ? 'Like songs to see them here' : 'No songs yet'}</Text>
          </View>
        ) : (
          data.tracks.map((s, i) => (
            <SongRow
              key={s.id}
              song={s}
              testIDPrefix="playlist-track"
              onPress={() => play(i)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm },
  iconBtn: { padding: theme.spacing.sm },
  heroBlock: { alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  cover: { width: 200, height: 200, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: '700', marginTop: theme.spacing.lg, textAlign: 'center' },
  desc: { color: theme.colors.textDim, fontSize: 13, marginTop: 6, textAlign: 'center' },
  meta: { color: theme.colors.textDim, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg, borderRadius: theme.radius.pill, minWidth: 56, justifyContent: 'center' },
  actionText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: theme.spacing.md },
  emptyText: { color: theme.colors.textDim, fontSize: 14 },
});
