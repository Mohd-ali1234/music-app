import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { theme } from '@/src/theme';
import { api, Playlist } from '@/src/lib/api';
import { usePlayer } from '@/src/lib/player';

export default function Library() {
  const router = useRouter();
  const likedCount = usePlayer(s => s.likedIds.size);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    try {
      const pls = await api.get<Playlist[]>('/playlists');
      setPlaylists(pls || []);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!name.trim()) return;
    try {
      await api.post('/playlists', { name: name.trim() });
      setName(''); setModalOpen(false); load();
    } catch (e) { console.warn(e); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <Pressable
          testID="create-playlist-btn"
          onPress={() => setModalOpen(true)}
          hitSlop={10}
          style={styles.headerBtn}
        >
          <Ionicons name="add" size={26} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <Pressable
          testID="liked-songs-row"
          onPress={() => router.push('/playlist/liked')}
          style={styles.libRow}
        >
          <View style={[styles.iconBox, { backgroundColor: theme.colors.liked + '22' }]}>
            <Ionicons name="heart" size={22} color={theme.colors.liked} />
          </View>
          <View style={styles.libInfo}>
            <Text style={styles.libTitle}>Liked Songs</Text>
            <Text style={styles.libMeta}>{likedCount} songs</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textDim} />
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.subHeader}>
          <Text style={styles.subTitle}>Your Playlists</Text>
          <Text style={styles.subMeta}>{playlists.length}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 32 }} />
        ) : playlists.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="albums-outline" size={48} color={theme.colors.textDim} />
            <Text style={styles.emptyText}>No playlists yet</Text>
            <Pressable testID="empty-create-btn" onPress={() => setModalOpen(true)} style={styles.emptyCta}>
              <Text style={styles.emptyCtaText}>Create Playlist</Text>
            </Pressable>
          </View>
        ) : (
          playlists.map((p) => (
            <Pressable
              key={p.id}
              testID={`playlist-row-${p.id}`}
              onPress={() => router.push(`/playlist/${p.id}`)}
              style={styles.libRow}
            >
              {p.cover ? (
                <Image source={{ uri: p.cover }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, { backgroundColor: theme.colors.brandDark, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="musical-notes" size={20} color={theme.colors.brandLight} />
                </View>
              )}
              <View style={styles.libInfo}>
                <Text style={styles.libTitle}>{p.name}</Text>
                <Text style={styles.libMeta}>{p.song_count} songs</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDim} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <Pressable onPress={() => setModalOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Playlist</Text>
            <TextInput
              testID="new-playlist-name"
              value={name}
              onChangeText={setName}
              placeholder="Playlist name"
              placeholderTextColor={theme.colors.textDim}
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable testID="cancel-create-playlist" onPress={() => { setModalOpen(false); setName(''); }} style={[styles.modalBtn, { backgroundColor: theme.colors.surface2 }]}>
                <Text style={{ color: theme.colors.text }}>Cancel</Text>
              </Pressable>
              <Pressable testID="confirm-create-playlist" onPress={create} style={[styles.modalBtn, { backgroundColor: theme.colors.brand }]}>
                <Text style={{ color: '#FFF', fontWeight: '600' }}>Create</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
  },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: '700' },
  headerBtn: { padding: theme.spacing.sm },
  libRow: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
  },
  iconBox: { width: 52, height: 52, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  cover: { width: 52, height: 52, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface2 },
  libInfo: { flex: 1 },
  libTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  libMeta: { color: theme.colors.textDim, fontSize: 12, marginTop: 3 },
  divider: { height: 1, backgroundColor: theme.colors.divider, marginVertical: theme.spacing.md, marginHorizontal: theme.spacing.lg },
  subHeader: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
  },
  subTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  subMeta: { color: theme.colors.textDim, fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: theme.spacing.md },
  emptyText: { color: theme.colors.textDim, fontSize: 14 },
  emptyCta: { backgroundColor: theme.colors.brand, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, borderRadius: theme.radius.pill },
  emptyCtaText: { color: '#FFF', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl },
  modal: { width: '100%', maxWidth: 380, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.xl },
  modalTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: theme.spacing.lg },
  modalInput: { backgroundColor: theme.colors.bg, color: theme.colors.text, borderRadius: theme.radius.md, padding: theme.spacing.md, fontSize: 15, borderWidth: 1, borderColor: theme.colors.border },
  modalActions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
  modalBtn: { flex: 1, paddingVertical: theme.spacing.md, alignItems: 'center', borderRadius: theme.radius.pill },
});
