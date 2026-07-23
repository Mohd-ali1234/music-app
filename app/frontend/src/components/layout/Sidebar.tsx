import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";

import { Typography } from "@/src/components/ui";
import { api, Playlist } from "@/src/lib/api";
import { DJ_INTENT_LABELS, useDJ } from "@/src/lib/dj";
import { theme } from "@/src/theme";

/**
 * Persistent desktop navigation.
 *
 * Replaces the bottom tab bar above 1024px, where a horizontal strip of four
 * icons wastes a screen edge that can hold real navigation. Renders only in
 * the desktop shell — mobile keeps its tab bar untouched.
 */

const NAV_ITEMS = [
  { label: "Home", icon: "home", route: "/(tabs)/home", match: "/home" },
  { label: "Search", icon: "search", route: "/(tabs)/search", match: "/search" },
  { label: "Library", icon: "albums", route: "/(tabs)/library", match: "/library" },
  { label: "Profile", icon: "person", route: "/(tabs)/profile", match: "/profile" },
] as const;

export const SIDEBAR_WIDTH = 248;

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const djIntent = useDJ((s) => s.intent);
  const djSession = useDJ((s) => s.sessionId);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ playlists?: Playlist[] }>("/playlists")
      .then((data) => {
        if (!cancelled) setPlaylists(data.playlists ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.brandMark} />
        <Typography variant="caption" weight="black" uppercase letterSpacing={3}>
          Player
        </Typography>
      </View>

      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = pathname.includes(item.match);
          return (
            <NavRow
              key={item.route}
              label={item.label}
              icon={item.icon}
              active={active}
              onPress={() => router.push(item.route as never)}
            />
          );
        })}
      </View>

      {/* --- AI DJ entry point --- */}
      <Pressable
        onPress={() => router.push("/dj" as never)}
        style={[styles.djCard, djSession && styles.djCardActive]}
        accessibilityRole="button"
        accessibilityLabel="Open AI DJ"
      >
        <View style={styles.djHead}>
          <Ionicons
            name="radio"
            size={15}
            color={djSession ? theme.colors.success : theme.colors.textSecondary}
          />
          <Typography variant="caption" weight="bold" uppercase>
            AI DJ
          </Typography>
        </View>
        <Typography variant="tiny" color={theme.colors.textMuted} numberOfLines={1}>
          {djSession && djIntent
            ? DJ_INTENT_LABELS[djIntent]
            : "Idle — press play to start"}
        </Typography>
      </Pressable>

      <View style={styles.divider} />

      <Typography
        variant="tiny"
        weight="bold"
        uppercase
        color={theme.colors.textMuted}
        style={styles.sectionLabel}
      >
        Playlists
      </Typography>

      <ScrollView
        style={styles.playlists}
        contentContainerStyle={styles.playlistsContent}
        showsVerticalScrollIndicator={false}
      >
        {playlists.length === 0 ? (
          <Typography variant="small" color={theme.colors.textMuted}>
            No playlists yet.
          </Typography>
        ) : (
          playlists.map((playlist) => (
            <Pressable
              key={playlist.id}
              onPress={() => router.push(`/playlist/${playlist.id}` as never)}
              style={({ hovered }: any) => [
                styles.playlistRow,
                hovered && styles.rowHovered,
              ]}
              accessibilityRole="button"
            >
              <Typography variant="bodySmall" numberOfLines={1}>
                {playlist.name}
              </Typography>
              <Typography variant="tiny" color={theme.colors.textMuted}>
                {playlist.song_count} tracks
              </Typography>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function NavRow({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ hovered }: any) => [
        styles.navRow,
        hovered && styles.rowHovered,
        active && styles.navRowActive,
      ]}
    >
      <Ionicons
        name={(active ? icon : `${icon}-outline`) as any}
        size={18}
        color={active ? theme.colors.background : theme.colors.textSecondary}
      />
      <Typography
        variant="bodySmall"
        weight={active ? "bold" : "medium"}
        color={active ? theme.colors.background : theme.colors.textSecondary}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: theme.colors.card,
    borderRightWidth: theme.borderWidth.thin,
    borderRightColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  brandMark: {
    width: 14,
    height: 14,
    backgroundColor: theme.colors.text,
  },
  nav: {
    paddingHorizontal: theme.spacing.sm,
    gap: 2,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  navRowActive: {
    backgroundColor: theme.colors.text,
  },
  rowHovered: {
    backgroundColor: theme.colors.overlayLight,
  },
  djCard: {
    marginHorizontal: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border,
    gap: 4,
  },
  djCardActive: {
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.secondary,
  },
  djHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  divider: {
    height: theme.borderWidth.thin,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
  },
  sectionLabel: {
    paddingHorizontal: theme.spacing.md,
  },
  playlists: {
    flex: 1,
  },
  playlistsContent: {
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: 2,
  },
  playlistRow: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs + 2,
  },
});
