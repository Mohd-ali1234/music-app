import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { Song } from '@/src/lib/api';
import { usePlayer } from '@/src/lib/player';

type Props = {
  song: Song;
  onPress?: () => void;
  showAlbum?: boolean;
  testIDPrefix?: string;
};

export default function SongRow({ song, onPress, showAlbum, testIDPrefix = 'song-row' }: Props) {
  const liked = usePlayer(s => s.likedIds.has(song.id));
  const toggleLike = usePlayer(s => s.toggleLike);
  const current = usePlayer(s => s.current);
  const isCurrent = current?.id === song.id;
  const isExternal = song.id.startsWith('external:');

  return (
    <Pressable
      testID={`${testIDPrefix}-${song.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <Image
        source={song.artwork ? { uri: song.artwork } : undefined}
        style={styles.art}
        contentFit="cover"
      />
      <View style={styles.info}>
        <Text style={[styles.title, isCurrent && { color: theme.colors.brand }]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {song.artist}{showAlbum && song.album ? ` • ${song.album}` : ''}
        </Text>
      </View>
      {!isExternal && <Pressable
        testID={`like-btn-${song.id}`}
        onPress={() => toggleLike(song.id)}
        hitSlop={10}
        style={styles.iconBtn}
      >
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={20}
          color={liked ? theme.colors.liked : theme.colors.textDim}
        />
      </Pressable>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  art: { width: 48, height: 48, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface2 },
  info: { flex: 1 },
  title: { color: theme.colors.text, fontSize: 15, fontWeight: '500' },
  meta: { color: theme.colors.textDim, fontSize: 12, marginTop: 3 },
  iconBtn: { padding: theme.spacing.sm },
});
