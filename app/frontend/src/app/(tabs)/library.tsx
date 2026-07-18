import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { theme } from "@/src/theme";
import { api, Playlist } from "@/src/lib/api";
import { usePlayer } from "@/src/lib/player";
import { BrutalHeading, BrutalLabel } from "@/src/components/brutal/BrutalText";

const TABS: { key: string; label: string }[] = [
  { key: "playlists", label: "PLAYLISTS" },
  { key: "albums", label: "ALBUMS" },
  { key: "artists", label: "ARTISTS" },
  { key: "songs", label: "SONGS" },
];

export default function Library() {
  const router = useRouter();
  const likedCount = usePlayer((s) => s.likedIds.size);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [active, setActive] = useState("playlists");

  const load = useCallback(async () => {
    try {
      const { playlists } = await api.get<{ playlists?: Playlist[] }>(
        "/playlists",
      );
      setPlaylists(Array.isArray(playlists) ? playlists : []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const create = async () => {
    if (!name.trim()) return;
    try {
      await api.post("/playlists", { name: name.trim() });
      setName("");
      setModalOpen(false);
      load();
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <BrutalHeading size="lg">LIBRARY</BrutalHeading>
        <Pressable testID="settings-btn" hitSlop={12} style={styles.iconBtn}>
          <Ionicons
            name="settings-outline"
            size={22}
            color={theme.colors.text}
          />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <Pressable
              key={t.key}
              testID={`lib-tab-${t.key}`}
              onPress={() => setActive(t.key)}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          testID="create-playlist-btn"
          onPress={() => setModalOpen(true)}
          style={styles.createRow}
        >
          <View style={styles.createIcon}>
            <Ionicons name="add" size={22} color={theme.colors.background} />
          </View>
          <Text style={styles.createText}>CREATE PLAYLIST</Text>
        </Pressable>

        <Pressable
          testID="liked-songs-row"
          onPress={() => router.push("/playlist/liked")}
          style={styles.row}
        >
          <View style={styles.likedArt}>
            <Ionicons name="heart" size={24} color={theme.colors.text} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>FAVORITES</Text>
            <Text style={styles.rowMeta}>{likedCount} SONGS</Text>
          </View>
          <Pressable style={styles.moreBtn} hitSlop={10}>
            <Ionicons
              name="ellipsis-horizontal"
              size={16}
              color={theme.colors.textMuted}
            />
          </Pressable>
        </Pressable>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.text} size="large" />
          </View>
        ) : playlists.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="albums-outline"
              size={48}
              color={theme.colors.textMuted}
            />
            <BrutalLabel style={{ marginTop: 16 }}>
              NO PLAYLISTS YET
            </BrutalLabel>
          </View>
        ) : (
          playlists.map((p) => (
            <Pressable
              key={p.id}
              testID={`playlist-row-${p.id}`}
              onPress={() => router.push(`/playlist/${p.id}`)}
              style={styles.row}
            >
              {p.cover ? (
                <Image
                  source={{ uri: p.cover }}
                  style={styles.rowArt}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.rowArt, styles.fallback]}>
                  <Ionicons
                    name="musical-notes"
                    size={22}
                    color={theme.colors.text}
                  />
                </View>
              )}
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {p.name.toUpperCase()}
                </Text>
                <Text style={styles.rowMeta}>{p.song_count} SONGS</Text>
              </View>
              <Pressable style={styles.moreBtn} hitSlop={10}>
                <Ionicons
                  name="ellipsis-horizontal"
                  size={16}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <Pressable
            onPress={() => setModalOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modal}>
            <BrutalHeading size="sm" style={{ marginBottom: 20 }}>
              NEW PLAYLIST
            </BrutalHeading>
            <TextInput
              testID="new-playlist-name"
              value={name}
              onChangeText={setName}
              placeholder="PLAYLIST NAME"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.modalInput}
              autoCapitalize="characters"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                testID="cancel-create-playlist"
                onPress={() => {
                  setModalOpen(false);
                  setName("");
                }}
                style={[styles.modalBtn, styles.modalBtnGhost]}
              >
                <Text style={styles.modalBtnGhostText}>CANCEL</Text>
              </Pressable>
              <Pressable
                testID="confirm-create-playlist"
                onPress={create}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                <Text style={styles.modalBtnPrimaryText}>CREATE</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  iconBtn: { padding: 4 },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabActive: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  tabTextActive: { color: theme.colors.background },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  createIcon: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  createText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowArt: { width: 56, height: 56, backgroundColor: theme.colors.secondary },
  fallback: { alignItems: "center", justifyContent: "center" },
  likedArt: {
    width: 56,
    height: 56,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  rowMeta: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  moreBtn: { padding: 8 },
  loading: { alignItems: "center", paddingVertical: 60 },
  empty: { alignItems: "center", paddingVertical: 80 },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    padding: 24,
  },
  modalInput: {
    color: theme.colors.text,
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 20,
  },
  modalActions: { flexDirection: "row", gap: 10 },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalBtnGhost: {
    borderColor: theme.colors.border,
    backgroundColor: "transparent",
  },
  modalBtnPrimary: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.text,
  },
  modalBtnGhostText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  modalBtnPrimaryText: {
    color: theme.colors.background,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
});
// "
// Observation: Overwrite successful: /app/frontend/src/app/(tabs)/library.tsx
