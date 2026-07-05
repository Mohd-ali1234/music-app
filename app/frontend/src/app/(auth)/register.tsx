import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/lib/auth';
import { theme } from '@/src/theme';

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!email || !password) { setErr('Email and password are required'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    setLoading(true);
    try { await register(email.trim().toLowerCase(), password, name || undefined); }
    catch (e: any) { setErr(e.message || 'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.logo}>
            <View style={styles.logoCircle}>
              <Ionicons name="musical-notes" size={32} color="#FFF" />
            </View>
            <Text style={styles.brand}>Create account</Text>
            <Text style={styles.tag}>Start your private music library</Text>
          </View>

          <View>
            <Text style={styles.label}>Name (optional)</Text>
            <TextInput
              testID="register-name-input"
              placeholder="Alex Morgan"
              placeholderTextColor={theme.colors.textDim}
              value={name} onChangeText={setName}
              style={styles.input}
            />
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="register-email-input"
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.textDim}
              value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address"
              style={styles.input}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="register-password-input"
              placeholder="At least 6 characters"
              placeholderTextColor={theme.colors.textDim}
              value={password} onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
            />
            {err && <Text testID="register-error" style={styles.err}>{err}</Text>}

            <Pressable
              testID="register-submit-button"
              onPress={submit} disabled={loading}
              style={({ pressed }) => [styles.cta, (pressed || loading) && { opacity: 0.7 }]}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>Create Account</Text>}
            </Pressable>

            <Link href="/(auth)/login" asChild>
              <Pressable testID="register-go-login" style={styles.linkBtn}>
                <Text style={styles.linkText}>
                  Have an account? <Text style={{ color: theme.colors.brandLight, fontWeight: '600' }}>Sign in</Text>
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { flex: 1, padding: theme.spacing.xl, justifyContent: 'center' },
  logo: { alignItems: 'center', marginBottom: theme.spacing.xxl },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.brand,
    alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.lg,
  },
  brand: { color: theme.colors.text, fontSize: 24, fontWeight: '700' },
  tag: { color: theme.colors.textDim, fontSize: 13, marginTop: theme.spacing.xs },
  label: { color: theme.colors.textDim, fontSize: 12, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: theme.colors.surface, color: theme.colors.text,
    borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    fontSize: 15, borderWidth: 1, borderColor: theme.colors.border,
  },
  err: { color: theme.colors.danger, marginTop: theme.spacing.md, fontSize: 13 },
  cta: {
    backgroundColor: theme.colors.brand, borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.lg, alignItems: 'center', marginTop: theme.spacing.xl,
  },
  ctaText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  linkBtn: { marginTop: theme.spacing.lg, alignItems: 'center' },
  linkText: { color: theme.colors.textDim, fontSize: 14 },
});
