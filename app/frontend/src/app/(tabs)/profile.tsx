import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/lib/auth';
import { api } from '@/src/lib/api';

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<{ liked: number; playlists: number; plays: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await api.get<any>('/profile/stats');
      setStats(s);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const initials = (user?.name || user?.email || '?').slice(0, 2).toUpperCase();

  const settingsRow = (icon: any, label: string, onPress?: () => void, color?: string, testID?: string) => (
    <Pressable testID={testID} onPress={onPress} style={styles.row}>
      <Ionicons name={icon} size={20} color={color || theme.colors.textDim} />
      <Text style={[styles.rowText, color && { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textDim} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable testID="settings-btn" hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={styles.profileBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text testID="profile-name" style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.handle}>@{(user?.email || '').split('@')[0]}</Text>
          <View style={styles.premiumPill}>
            <Ionicons name="star" size={12} color="#FFF" />
            <Text style={styles.premiumText}>Premium</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.playlists ?? 0}</Text>
              <Text style={styles.statLabel}>Playlists</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.liked ?? 0}</Text>
              <Text style={styles.statLabel}>Liked</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.plays ?? 0}</Text>
              <Text style={styles.statLabel}>Plays</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          {settingsRow('person-outline', 'Account', undefined, undefined, 'settings-account')}
          {settingsRow('download-outline', 'Downloads', undefined, undefined, 'settings-downloads')}
          {settingsRow('play-circle-outline', 'Playback', undefined, undefined, 'settings-playback')}
          {settingsRow('notifications-outline', 'Notifications', undefined, undefined, 'settings-notifications')}
          {settingsRow('help-circle-outline', 'Help & Support', undefined, undefined, 'settings-help')}
        </View>

        <View style={styles.card}>
          {settingsRow('log-out-outline', 'Sign Out', async () => { await logout(); router.replace('/(auth)/login'); }, theme.colors.danger, 'sign-out-btn')}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  headerTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '700' },
  iconBtn: { padding: theme.spacing.sm },
  profileBlock: { alignItems: 'center', paddingVertical: theme.spacing.lg },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md },
  avatarText: { color: '#FFF', fontSize: 32, fontWeight: '700' },
  name: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
  handle: { color: theme.colors.textDim, fontSize: 13, marginTop: 4 },
  premiumPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: theme.spacing.md, backgroundColor: theme.colors.brand, paddingHorizontal: theme.spacing.md, paddingVertical: 4, borderRadius: theme.radius.pill },
  premiumText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: theme.colors.surface, marginHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg, paddingVertical: theme.spacing.lg, marginTop: theme.spacing.md,
  },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: theme.colors.textDim, fontSize: 11, marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: theme.colors.border },
  card: {
    backgroundColor: theme.colors.surface, marginHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg, marginTop: theme.spacing.lg, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  rowText: { flex: 1, color: theme.colors.text, fontSize: 14 },
});
