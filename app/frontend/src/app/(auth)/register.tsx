import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/lib/auth";
import { theme } from "@/src/theme";
import { StepWizard } from "@/src/components/onboarding/StepWizard";
import { SelectionCard } from "@/src/components/onboarding/SelectionCard";
import { AvatarCard } from "@/src/components/onboarding/AvatarCard";
import { ARTIST_FILTER_TAGS, ARTIST_OPTIONS, PREFERENCE_OPTIONS } from "@/src/constants/onboarding-data";

const TOTAL_STEPS = 3;
const MIN_ARTISTS = 3;

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id];
}

function PillButton({ label, onPress, disabled, loading, testID }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={disabled || loading ? undefined : onPress}
      style={[pillStyles.pill, disabled && pillStyles.pillDisabled]}
    >
      {loading ? <ActivityIndicator color="#000000" /> : <Text style={pillStyles.pillText}>{label}</Text>}
    </Pressable>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  pillDisabled: { opacity: 0.35 },
  pillText: { color: "#000000", fontSize: 15, fontWeight: "800" },
});

export default function Register() {
  const { register } = useAuth();
  const [step, setStep] = useState(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [prefIds, setPrefIds] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("All");
  const [artistIds, setArtistIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredArtists = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ARTIST_OPTIONS.filter(
      (artist) =>
        (activeTag === "All" || artist.tags.includes(activeTag)) &&
        (!q || artist.name.toLowerCase().includes(q)),
    );
  }, [search, activeTag]);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const selectedPrefs = PREFERENCE_OPTIONS.filter((p) => prefIds.includes(p.id));
      const genres = selectedPrefs.filter((p) => p.type === "genre").map((p) => p.label);
      const languages = selectedPrefs.filter((p) => p.type === "language").map((p) => p.label);
      const favorite_artists = ARTIST_OPTIONS.filter((a) => artistIds.includes(a.id)).map((a) => a.name);
      await register(email.trim(), password, displayName || undefined, {
        favorite_artists,
        genres,
        languages,
        moods: [],
        decades: [],
      });
    } catch (e: any) {
      setError(e.message || "Could not create account.");
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  if (step === 0) {
    const canNext = !!email.trim() && password.length >= 8;
    return (
      <StepWizard
        step={0}
        totalSteps={TOTAL_STEPS}
        title="Let's get you set up"
        subtitle="Create your account to start building your sound."
        footer={
          <>
            {!!error && <Text testID="register-error" style={styles.error}>{error}</Text>}
            <PillButton testID="register-next-1" label="Next" disabled={!canNext} onPress={() => setStep(1)} />
            <Link href="/(auth)/login" asChild>
              <Pressable testID="register-go-login" style={styles.login}>
                <Text style={styles.loginText}>
                  Already have an account? <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Sign in</Text>
                </Text>
              </Pressable>
            </Link>
          </>
        }
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Display name</Text>
            <TextInput
              testID="register-name-input"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Alex Morgan"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="register-email-input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="register-password-input"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 8 characters"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </StepWizard>
    );
  }

  if (step === 1) {
    const canNext = prefIds.length >= 1;
    return (
      <StepWizard
        step={1}
        totalSteps={TOTAL_STEPS}
        onBack={() => setStep(0)}
        title="What do you like to listen to?"
        subtitle="Pick a few genres and languages. You can change these later."
        footer={<PillButton testID="register-next-2" label="Next" disabled={!canNext} onPress={() => setStep(2)} />}
      >
        <FlatList
          data={PREFERENCE_OPTIONS}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.prefRow}
          contentContainerStyle={styles.prefGrid}
          renderItem={({ item }) => (
            <SelectionCard
              testID={`pref-${item.id}`}
              label={item.label}
              color={item.color}
              image={item.image}
              selected={prefIds.includes(item.id)}
              onPress={() => setPrefIds((ids) => toggleId(ids, item.id))}
            />
          )}
        />
      </StepWizard>
    );
  }

  const canFinish = artistIds.length >= MIN_ARTISTS;
  return (
    <StepWizard
      step={2}
      totalSteps={TOTAL_STEPS}
      onBack={() => setStep(1)}
      title="Follow some artists"
      subtitle={`Pick at least ${MIN_ARTISTS} to fine-tune your recommendations.`}
      footer={
        <>
          {!!error && <Text testID="register-error" style={styles.error}>{error}</Text>}
          <View style={styles.doneRow}>
            <Text style={styles.countText}>{artistIds.length} selected</Text>
          </View>
          <PillButton testID="register-submit-button" label="Done" disabled={!canFinish} loading={loading} onPress={submit} />
        </>
      }
    >
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          testID="register-artist-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search artists"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.searchInput}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {ARTIST_FILTER_TAGS.map((tag) => (
          <Pressable
            key={tag}
            testID={`artist-filter-${tag}`}
            onPress={() => setActiveTag(tag)}
            style={[styles.chip, activeTag === tag && styles.chipActive]}
          >
            <Text style={[styles.chipText, activeTag === tag && styles.chipTextActive]}>{tag}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={filteredArtists}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={styles.artistRow}
        contentContainerStyle={styles.artistGrid}
        renderItem={({ item }) => (
          <AvatarCard
            testID={`artist-${item.id}`}
            name={item.name}
            color={item.color}
            image={item.image}
            selected={artistIds.includes(item.id)}
            onPress={() => setArtistIds((ids) => toggleId(ids, item.id))}
          />
        )}
      />
    </StepWizard>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: 20, paddingBottom: 20, gap: 4 },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    color: theme.colors.text,
    fontSize: 15,
    padding: 14,
  },
  error: { color: theme.colors.danger, fontSize: 12, marginBottom: 12, textAlign: "center" },
  login: { alignItems: "center", marginTop: 18 },
  loginText: { color: theme.colors.textMuted, fontSize: 13 },
  prefGrid: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  prefRow: { gap: 12 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    backgroundColor: theme.colors.secondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 14 },
  chipRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: theme.colors.green, borderColor: theme.colors.green },
  chipText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#04120A" },
  artistGrid: { paddingHorizontal: 20, paddingBottom: 20, gap: 18 },
  artistRow: { gap: 8, justifyContent: "flex-start" },
  doneRow: { alignItems: "center", marginBottom: 10 },
  countText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "700" },
});
