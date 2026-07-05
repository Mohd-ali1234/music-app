import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/src/theme';
import { usePlayer, formatTime } from '@/src/lib/player';

export default function PlayerScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const current = usePlayer(s => s.current);
  const isPlaying = usePlayer(s => s.isPlaying);
  const isLoading = usePlayer(s => s.isLoading);
  const position = usePlayer(s => s.position);
  const duration = usePlayer(s => s.duration);
  const shuffle = usePlayer(s => s.shuffle);
  const repeat = usePlayer(s => s.repeat);
  const togglePlay = usePlayer(s => s.togglePlay);
  const next = usePlayer(s => s.next);
  const prev = usePlayer(s => s.prev);
  const seek = usePlayer(s => s.seek);
  const toggleShuffle = usePlayer(s => s.toggleShuffle);
  const cycleRepeat = usePlayer(s => s.cycleRepeat);
  const toggleLike = usePlayer(s => s.toggleLike);
  const liked = usePlayer(s => current ? s.likedIds.has(current.id) : false);
  const queue = usePlayer(s => s.queue);
  const queueIndex = usePlayer(s => s.index);
  const playFromQueue = usePlayer(s => s.playFromQueue);

  if (!current) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: '#FFF', textAlign: 'center', marginTop: 40 }}>No track playing</Text>
      </SafeAreaView>
    );
  }

  const progress = duration > 0 ? position / duration : 0;
  const onSeekTap = (e: any) => {
    const { locationX, target } = e.nativeEvent;
    e.target?.measure?.((_x: number, _y: number, w: number) => {
      if (w && duration) seek((locationX / w) * duration);
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable testID="player-close" onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <Ionicons name="chevron-down" size={26} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>PLAYING FROM</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{current.album || 'Single'}</Text>
        </View>
        <Pressable testID="player-more" hitSlop={10} style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, isWide && styles.bodyWide]} showsVerticalScrollIndicator={false}>
        <View style={[styles.playerGrid, isWide && styles.playerGridWide]}>
        <View style={[styles.artColumn, isWide && styles.artColumnWide]}>
        <View style={[styles.artWrap, isWide && styles.artWrapWide]}>
          <Image
            source={current.artwork ? { uri: current.artwork } : undefined}
            style={styles.art}
            contentFit="cover"
          />
          {isLoading && (
            <View style={styles.loadOverlay}><ActivityIndicator color="#FFF" /></View>
          )}
        </View>
        </View>

        <View style={[styles.detailsColumn, isWide && styles.detailsColumnWide]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.songTitle} numberOfLines={1}>{current.title}</Text>
            <Text style={styles.songArtist} numberOfLines={1}>{current.artist}</Text>
          </View>
          <Pressable testID="player-like-btn" onPress={() => toggleLike(current.id)} hitSlop={10}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={28}
              color={liked ? theme.colors.liked : theme.colors.textDim}
            />
          </Pressable>
        </View>

        <View style={styles.progress}>
          <Pressable onPress={onSeekTap} style={styles.progressTrack} testID="seek-bar">
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.progressKnob, { left: `${progress * 100}%` }]} />
          </Pressable>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration || current.duration)}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable testID="shuffle-btn" onPress={toggleShuffle} hitSlop={10}>
            <Ionicons name="shuffle" size={22} color={shuffle ? theme.colors.brand : theme.colors.textDim} />
          </Pressable>
          <Pressable testID="prev-btn" onPress={prev} hitSlop={10}>
            <Ionicons name="play-skip-back" size={32} color={theme.colors.text} />
          </Pressable>
          <Pressable testID="play-pause-btn" onPress={togglePlay} style={styles.playBig}>
            {isLoading ? <ActivityIndicator color="#FFF" /> : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#FFF" />
            )}
          </Pressable>
          <Pressable testID="next-btn" onPress={next} hitSlop={10}>
            <Ionicons name="play-skip-forward" size={32} color={theme.colors.text} />
          </Pressable>
          <Pressable testID="repeat-btn" onPress={cycleRepeat} hitSlop={10}>
            <Ionicons
              name={repeat === 'one' ? 'repeat' : 'repeat'}
              size={22}
              color={repeat !== 'off' ? theme.colors.brand : theme.colors.textDim}
            />
            {repeat === 'one' && (
              <View style={styles.repeatDot}><Text style={{ color: '#FFF', fontSize: 8, fontWeight: '700' }}>1</Text></View>
            )}
          </Pressable>
        </View>

        <View style={styles.bottomRow}>
          <Pressable testID="lyrics-btn" style={styles.lyricsBtn}>
            <Text style={styles.lyricsText}>Lyrics</Text>
          </Pressable>
        </View>
        </View>
        </View>

        <View style={[styles.queueSection, isWide && styles.queueSectionWide]}>
          <View style={styles.queueHeader}>
            <Text style={styles.queueTitle}>Up Next</Text>
            <Text style={styles.queueCount}>{Math.max(queue.length - queueIndex - 1, 0)} songs</Text>
          </View>
          {queue.slice(queueIndex + 1).length ? queue.slice(queueIndex + 1).map((song, offset) => {
            const actualIndex = queueIndex + offset + 1;
            return <Pressable
              key={`${song.id}-${actualIndex}`}
              testID={`queue-song-${actualIndex}`}
              onPress={() => playFromQueue(actualIndex)}
              style={({ pressed }) => [styles.queueRow, pressed && styles.queueRowPressed]}
            >
              <Text style={styles.queueNumber}>{actualIndex + 1}</Text>
              <Image source={song.artwork ? { uri: song.artwork } : undefined} style={styles.queueArt} contentFit="cover" />
              <View style={styles.queueInfo}>
                <Text style={styles.queueSongTitle} numberOfLines={1}>{song.title}</Text>
                <Text style={styles.queueArtist} numberOfLines={1}>{song.artist}{song.album ? ` • ${song.album}` : ''}</Text>
              </View>
              <Text style={styles.queueDuration}>{formatTime(song.duration)}</Text>
              <Ionicons name="play-outline" size={20} color={theme.colors.textDim} />
            </Pressable>;
          }) : <View style={styles.queueEmpty}>
            <Ionicons name="checkmark-circle-outline" size={28} color={theme.colors.textDim} />
            <Text style={styles.queueEmptyText}>This is the last song in the queue</Text>
          </View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm },
  headerBtn: { padding: theme.spacing.sm },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerLabel: { color: theme.colors.textDim, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  headerTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  body: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl, alignItems: 'stretch', width: '100%', maxWidth: 1180, alignSelf: 'center' },
  bodyWide: { paddingHorizontal: theme.spacing.xxl },
  playerGrid: { width: '100%' },
  playerGridWide: { flexDirection: 'row', alignItems: 'center', gap: 56, paddingTop: theme.spacing.xl },
  artColumn: { width: '100%' },
  artColumnWide: { width: '46%', maxWidth: 480 },
  detailsColumn: { width: '100%' },
  detailsColumnWide: { flex: 1 },
  artWrap: { aspectRatio: 1, borderRadius: theme.radius.lg, overflow: 'hidden', marginTop: theme.spacing.lg, backgroundColor: theme.colors.surface, position: 'relative' },
  artWrapWide: { marginTop: 0, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 18 } },
  art: { width: '100%', height: '100%' },
  loadOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.xl, gap: theme.spacing.md },
  songTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '700' },
  songArtist: { color: theme.colors.textDim, fontSize: 15, marginTop: 4 },
  progress: { marginTop: theme.spacing.xl },
  progressTrack: { height: 4, backgroundColor: theme.colors.surface2, borderRadius: 2, position: 'relative' },
  progressFill: { height: '100%', backgroundColor: theme.colors.brand, borderRadius: 2 },
  progressKnob: { position: 'absolute', top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFF', marginLeft: -6 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.sm },
  timeText: { color: theme.colors.textDim, fontSize: 11 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.xxl, paddingHorizontal: theme.spacing.sm },
  playBig: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
  repeatDot: { position: 'absolute', top: -6, right: -8, width: 14, height: 14, borderRadius: 7, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.xxl },
  lyricsBtn: { paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface },
  lyricsText: { color: theme.colors.text, fontSize: 13, fontWeight: '500' },
  queueSection: { marginTop: theme.spacing.xxl, borderTopWidth: 1, borderTopColor: theme.colors.divider, paddingTop: theme.spacing.xl },
  queueSectionWide: { marginTop: 48 },
  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  queueTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
  queueCount: { color: theme.colors.textDim, fontSize: 12 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, borderRadius: theme.radius.md },
  queueRowPressed: { backgroundColor: theme.colors.surface },
  queueNumber: { color: theme.colors.textDim, fontSize: 12, width: 22, textAlign: 'center' },
  queueArt: { width: 48, height: 48, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface2 },
  queueInfo: { flex: 1, minWidth: 0 },
  queueSongTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  queueArtist: { color: theme.colors.textDim, fontSize: 12, marginTop: 3 },
  queueDuration: { color: theme.colors.textDim, fontSize: 12 },
  queueEmpty: { alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xxl },
  queueEmptyText: { color: theme.colors.textDim, fontSize: 13 },
});
