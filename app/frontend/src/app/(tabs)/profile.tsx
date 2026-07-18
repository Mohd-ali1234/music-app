// Action: file_editor create /app/frontend/src/app/(tabs)/profile.tsx --file-text "
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/lib/auth";
import { api } from "@/src/lib/api";
import { BrutalHeading, BrutalLabel } from "@/src/components/brutal/BrutalText";

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<{
    liked: number;
    playlists: number;
    plays: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [hqAudio, setHqAudio] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.get<any>("/profile/stats");
      setStats(s);
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

  const initials = (user?.name || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BrutalHeading size="lg">SETTINGS</BrutalHeading>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        <BrutalLabel style={styles.sectionLabel}>ACCOUNT</BrutalLabel>
        <Pressable style={styles.accountRow} testID="account-row">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.accountInfo}>
            <Text testID="profile-name" style={styles.accountName}>
              {(user?.name || "BRUTAL USER").toUpperCase()}
            </Text>
            <Text style={styles.accountEmail}>
              {user?.email || "user@brutal.app"}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.colors.textMuted}
          />
        </Pressable>

        {!loading && stats && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.playlists ?? 0}</Text>
              <Text style={styles.statLabel}>PLAYLISTS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.liked ?? 0}</Text>
              <Text style={styles.statLabel}>LIKED</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.plays ?? 0}</Text>
              <Text style={styles.statLabel}>PLAYS</Text>
            </View>
          </View>
        )}

        <BrutalLabel style={styles.sectionLabel}>PREFERENCES</BrutalLabel>
        <ToggleRow
          label="DARK MODE"
          value={darkMode}
          onChange={setDarkMode}
          testID="settings-dark"
        />
        <ToggleRow
          label="HIGH QUALITY AUDIO"
          value={hqAudio}
          onChange={setHqAudio}
          testID="settings-hq"
        />
        <ToggleRow
          label="OFFLINE MODE"
          value={offline}
          onChange={setOffline}
          testID="settings-offline"
        />
        <NavRow label="CROSSFADE" value="5 SEC" testID="settings-crossfade" />
        <NavRow label="EQUALIZER" value="CUSTOM" testID="settings-equalizer" />

        <BrutalLabel style={styles.sectionLabel}>ABOUT</BrutalLabel>
        <NavRow label="ABOUT BRUTAL" testID="settings-about" />
        <NavRow label="PRIVACY POLICY" testID="settings-privacy" />
        <NavRow label="TERMS OF SERVICE" testID="settings-terms" />

        <Pressable
          testID="sign-out-btn"
          onPress={async () => {
            await logout();
            router.replace("/(auth)/login");
          }}
          style={styles.signOut}
        >
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <View style={styles.settingRow} testID={testID}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.secondary, true: theme.colors.text }}
        thumbColor={theme.colors.background}
        ios_backgroundColor={theme.colors.secondary}
      />
    </View>
  );
}

function NavRow({
  label,
  value,
  testID,
}: {
  label: string;
  value?: string;
  testID?: string;
}) {
  return (
    <Pressable style={styles.settingRow} testID={testID}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        <Ionicons
          name="chevron-forward"
          size={16}
          color={theme.colors.textMuted}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  sectionLabel: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  accountInfo: { flex: 1 },
  accountName: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  accountEmail: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: 4,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 52,
  },
  settingLabel: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  settingValue: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  signOut: {
    marginHorizontal: 20,
    marginTop: 32,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingVertical: 16,
    alignItems: "center",
  },
  signOutText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
// "
// Observation: Overwrite successful: /app/frontend/src/app/(tabs)/profile.tsx
