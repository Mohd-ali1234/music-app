import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { usePlayer } from '@/src/lib/player';
import { theme } from '@/src/theme';

export default function MiniPlayer() {
  const router = useRouter();
  const current = usePlayer(s => s.current);
  const isPlaying = usePlayer(s => s.isPlaying);
  const position = usePlayer(s => s.position);
  const duration = usePlayer(s => s.duration);
  const togglePlay = usePlayer(s => s.togglePlay);

  if (!current) return null;

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <Pressable
      testID="mini-player"
      onPress={() => router.push('/player')}
      style={styles.wrap}
    >
      <View style={styles.row}>
        <Image
          source={current.artwork ? { uri: current.artwork } : undefined}
          style={styles.art}
          contentFit="cover"
        />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{current.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{current.artist}</Text>
        </View>
        <Pressable
          testID="mini-player-play-pause"
          onPress={(e) => { e.stopPropagation(); togglePlay(); }}
          hitSlop={12}
          style={styles.playBtn}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={theme.colors.text} />
        </Pressable>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  art: { width: 44, height: 44, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface2 },
  info: { flex: 1 },
  title: { color: theme.colors.text, fontWeight: '600', fontSize: 14 },
  artist: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  playBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  progressTrack: {
    height: 2, backgroundColor: theme.colors.surface2, borderRadius: 1,
    marginTop: theme.spacing.sm, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: theme.colors.brand },
});
