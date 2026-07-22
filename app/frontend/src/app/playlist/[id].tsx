import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { theme } from '@/src/theme';
import { api, Song } from '@/src/lib/api';
import { usePlayer } from '@/src/lib/player';
import SongRow from '@/src/components/SongRow';
import { AlbumCover, Button, ConfirmDialog, Skeleton, Typography } from '@/src/components/ui';

function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export default function PlaylistDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isLiked = id === 'liked';
  const playQueue = usePlayer(s => s.playQueue);

  const [data, setData] = useState<{ name: string; cover?: string | null; description?: string; tracks: Song[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Song | null>(null);

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

  const shufflePlay = () => {
    if (!data?.tracks.length) return;
    tap();
    const shuffled = [...data.tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    playQueue(shuffled, 0, 'playlist');
  };

  const removeSong = async () => {
    if (!removeTarget || !data) return;
    const remaining = data.tracks.filter((t) => t.id !== removeTarget.id);
    setRemoveTarget(null);
    setData({ ...data, tracks: remaining });
    try {
      await api.patch(`/playlists/${id}`, { song_ids: remaining.map((t) => t.id) });
    } catch (e) {
      console.warn(e);
      load();
    }
  };

  const deletePlaylist = async () => {
    setConfirmDelete(false);
    try {
      await api.del(`/playlists/${id}`);
      router.back();
    } catch (e) {
      console.warn(e);
    }
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
          </Pressable>
        </View>
        <View style={styles.heroBlock}>
          <Skeleton width={200} height={200} radius={theme.radius.md} />
          <Skeleton width={180} height={22} style={{ marginTop: theme.spacing.lg }} />
          <Skeleton width={100} height={14} style={{ marginTop: theme.spacing.sm }} />
        </View>
        <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={44} radius={theme.radius.md} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        {!isLiked && (
          <Pressable
            testID="playlist-more"
            onPress={() => {
              tap();
              setConfirmDelete(true);
            }}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.text} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.xxl }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(theme.motion.duration.base)} style={styles.heroBlock}>
          <AlbumCover
            source={data.cover}
            sources={data.tracks.map((t) => t.artwork)}
            size={200}
            style={styles.cover}
            fallbackColor={isLiked ? theme.colors.likedBg : theme.colors.secondary}
            fallbackIcon={
              <Ionicons
                name={isLiked ? 'heart' : 'musical-notes'}
                size={48}
                color={isLiked ? theme.colors.liked : theme.colors.textMuted}
              />
            }
          />
          <Typography variant="h3" weight="black" align="center" style={{ marginTop: theme.spacing.lg }}>
            {data.name.toUpperCase()}
          </Typography>
          {data.description ? (
            <Typography variant="bodySmall" color={theme.colors.textMuted} align="center" style={{ marginTop: theme.spacing.xs }}>
              {data.description}
            </Typography>
          ) : null}
          <Typography variant="caption" color={theme.colors.textMuted} uppercase letterSpacing={1} style={{ marginTop: theme.spacing.xs }}>
            {data.tracks.length} {data.tracks.length === 1 ? 'song' : 'songs'}
          </Typography>

          <View style={styles.actions}>
            <Button
              testID="play-playlist-btn"
              title="Play"
              variant="primary"
              size="lg"
              leftIcon={<Ionicons name="play" size={18} color={theme.colors.background} />}
              onPress={() => play(0)}
              disabled={data.tracks.length === 0}
              style={styles.playAction}
            />
            <Pressable
              testID="shuffle-playlist-btn"
              onPress={shufflePlay}
              disabled={data.tracks.length === 0}
              style={({ pressed }) => [
                styles.shuffleBtn,
                data.tracks.length === 0 && { opacity: theme.opacity.disabled },
                pressed && { opacity: theme.opacity.pressed },
              ]}
            >
              <Ionicons name="shuffle" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
        </Animated.View>

        {data.tracks.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="musical-notes-outline" size={42} color={theme.colors.textMuted} />
            <Typography variant="bodySmall" color={theme.colors.textMuted}>
              {isLiked ? 'Like songs to see them here' : 'No songs yet'}
            </Typography>
          </View>
        ) : (
          data.tracks.map((s, i) => (
            <SongRow
              key={s.id}
              song={s}
              testIDPrefix="playlist-track"
              onPress={() => play(i)}
              onRemove={isLiked ? undefined : () => setRemoveTarget(s)}
            />
          ))
        )}
      </ScrollView>

      <ConfirmDialog
        testID="delete-playlist-dialog"
        visible={confirmDelete}
        title="Delete playlist?"
        message={`"${data.name}" will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={deletePlaylist}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        testID="remove-song-dialog"
        visible={!!removeTarget}
        title="Remove song?"
        message={removeTarget ? `Remove "${removeTarget.title}" from this playlist.` : undefined}
        confirmLabel="Remove"
        onConfirm={removeSong}
        onCancel={() => setRemoveTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm },
  iconBtn: { padding: theme.spacing.sm },
  heroBlock: { alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  cover: { ...theme.shadows.sharp },
  actions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg, alignItems: 'center' },
  playAction: { minWidth: 140 },
  shuffleBtn: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: theme.spacing.xxxl, gap: theme.spacing.md },
});
