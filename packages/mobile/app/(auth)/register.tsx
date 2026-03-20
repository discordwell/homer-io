import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/api/client';
import { C, Size, Spacing, Radius, Base } from '@/theme';
import type { AuthResponse } from '@homer-io/shared';

export default function RegisterScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name.trim() || !orgName.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<AuthResponse>('/auth/register', {
        name: name.trim(),
        orgName: orgName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      await setAuth(response);

      if (response.user.role === 'driver') {
        router.replace('/(driver)/route');
      } else {
        router.replace('/(dispatch)/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={Base.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Set up your organization</Text>
        </View>

        <View style={styles.form}>
          <View>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="John Smith"
              placeholderTextColor={C.muted}
              autoCapitalize="words"
              autoComplete="name"
              style={Base.input}
            />
          </View>

          <View>
            <Text style={styles.label}>Organization name</Text>
            <TextInput
              value={orgName}
              onChangeText={setOrgName}
              placeholder="Acme Couriers"
              placeholderTextColor={C.muted}
              autoCapitalize="words"
              style={Base.input}
            />
          </View>

          <View>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor={C.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              style={Base.input}
            />
          </View>

          <View>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="8+ characters"
              placeholderTextColor={C.muted}
              secureTextEntry
              autoComplete="new-password"
              style={Base.input}
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={({ pressed }) => [
              Base.primaryBtn,
              loading && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={Base.primaryBtnText}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkAccent}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: Size.xxl,
    fontWeight: '700',
    color: C.text,
  },
  subtitle: {
    fontSize: Size.md,
    color: C.dim,
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: Size.sm,
    color: C.dim,
    marginBottom: 6,
    fontWeight: '500',
  },
  errorBox: {
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.19)',
  },
  errorText: {
    color: C.red,
    fontSize: Size.sm,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkText: {
    fontSize: Size.md,
    color: C.dim,
  },
  linkAccent: {
    color: C.accent,
    fontWeight: '600',
  },
});
