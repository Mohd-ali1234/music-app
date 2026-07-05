import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/src/theme';
import { api, Song } from '@/src/lib/api';
import { useAuth } from '@/src/lib/auth';
import { usePlayer } from '@/src/lib/player';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const playQueue = usePlayer(s => s.playQueue);

  const [trending, setTrending] = useState<Song[]>([]);
  const [recent, setRecent] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        api.get<Song[]>('/songs/trending/list'),
        api.get<Song[]>('/library/recent'),
      ]);
      setTrending(t || []);
      setRecent(r || []);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const continueTrack = recent[0] || trending[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FFF" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greet}>{greeting()} <Text>👋</Text></Text>
            <Text style={styles.subgreet}>{user?.name || 'Enjoy your favorite music'}</Text>
          </View>
          <Pressable testID="notifications-btn" hitSlop={10} style={styles.bell}>
            <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
            <View style={styles.dot} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={theme.colors.brand} /></View>
        ) : (
          <>
            {continueTrack && (
              <Pressable
                testID="continue-listening-card"
                onPress={() => playQueue(recent.length ? recent : trending, 0, recent.length ? 'recently_played' : 'home')}
                style={styles.continueCard}
              >
                <Image source={continueTrack.artwork ? { uri: continueTrack.artwork } : undefined} style={styles.continueArt} />
                <View style={styles.continueInfo}>
                  <Text style={styles.continueLabel}>Continue Listening</Text>
                  <Text style={styles.continueTitle} numberOfLines={1}>{continueTrack.title}</Text>
                  <Text style={styles.continueArtist} numberOfLines={1}>{continueTrack.artist}</Text>
                </View>
                <View style={styles.continuePlay}>
                  <Ionicons name="play" size={20} color={theme.colors.text} />
                </View>
              </Pressable>
            )}

            {recent.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recently Played</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
                  {recent.map((s) => (
                    <Pressable
                      key={s.id}
                      testID={`recent-card-${s.id}`}
                      style={styles.tile}
                      onPress={() => playQueue(recent, recent.findIndex(r => r.id === s.id), 'recently_played')}
                    >
                      <Image source={s.artwork ? { uri: s.artwork } : undefined} style={styles.tileArt} />
                      <Text style={styles.tileTitle} numberOfLines={1}>{s.title}</Text>
                      <Text style={styles.tileArtist} numberOfLines={1}>{s.artist}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Made For You</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
                {trending.map((s) => (
                  <Pressable
                    key={s.id}
                    testID={`trending-card-${s.id}`}
                    style={styles.tile}
                    onPress={() => playQueue(trending, trending.findIndex(t => t.id === s.id), 'home')}
                  >
                    <Image source={s.artwork ? { uri: s.artwork } : undefined} style={styles.tileArt} />
                    <Text style={styles.tileTitle} numberOfLines={1}>{s.title}</Text>
                    <Text style={styles.tileArtist} numberOfLines={1}>{s.artist}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={{ height: 140 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xl },
  greet: { color: theme.colors.text, fontSize: 24, fontWeight: '700' },
  subgreet: { color: theme.colors.textDim, fontSize: 13, marginTop: 4 },
  bell: { padding: theme.spacing.sm, position: 'relative' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.brand, position: 'absolute', top: 6, right: 6 },
  loading: { paddingVertical: 80, alignItems: 'center' },
  continueCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    padding: theme.spacing.md, gap: theme.spacing.md, marginBottom: theme.spacing.xl,
  },
  continueArt: { width: 60, height: 60, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface2 },
  continueInfo: { flex: 1 },
  continueLabel: { color: theme.colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  continueTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  continueArtist: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  continuePlay: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.surface2, alignItems: 'center', justifyContent: 'center',
  },
  section: { marginBottom: theme.spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md, gap: theme.spacing.sm },
  sectionTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  hList: { gap: theme.spacing.md, paddingRight: theme.spacing.lg },
  tile: { width: 140 },
  tileArt: { width: 140, height: 140, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, marginBottom: theme.spacing.sm },
  tileTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  tileArtist: { color: theme.colors.textDim, fontSize: 11, marginTop: 2 },
});
