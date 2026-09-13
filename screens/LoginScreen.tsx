import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';

interface LoginScreenProps {
  onNavigate: (screen: string) => void;
}

export default function LoginScreen({ onNavigate }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    const result = await login(email.trim(), password.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
  }
  async function handleGoogleLogin() {
  setError('');
  setLoading(true);

  const result = await loginWithGoogle();

  setLoading(false);

  if (!result.success) {
    setError(result.error || 'Google sign-in failed');
  }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={COMMON_STYLES.screen}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="storefront-outline" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.appName}>StoreFlow</Text>
          <Text style={styles.tagline}>Simple. Fast. Professional.</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your store account</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor={COLORS.textTertiary}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.disabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
          <View style={styles.orContainer}>
  <View style={styles.orLine} />
  <Text style={styles.orText}>OR</Text>
  <View style={styles.orLine} />
</View>

<TouchableOpacity
  style={[styles.googleButton, loading && styles.disabled]}
  onPress={handleGoogleLogin}
  disabled={loading}
>
  <Ionicons name="logo-google" size={20} color="#4285F4" />
  <Text style={styles.googleButtonText}>Continue with Google</Text>
</TouchableOpacity>
          
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => onNavigate('register')}>
            <Text style={styles.footerLink}>Create one</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  appName: {
    fontSize: FONT_SIZE.display,
    fontWeight: '800',
    color: COLORS.primary,
  },
  tagline: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  formContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOW.md,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    height: 52,
    paddingHorizontal: SPACING.md,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    height: 52,
  },
  eyeIcon: {
    padding: SPACING.xs,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  disabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  footerText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  footerLink: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '700',
  },
  orContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginVertical: SPACING.lg,
},

orLine: {
  flex: 1,
  height: 1,
  backgroundColor: COLORS.border,
},

orText: {
  marginHorizontal: SPACING.md,
  color: COLORS.textSecondary,
  fontSize: FONT_SIZE.sm,
  fontWeight: '600',
},

googleButton: {
  height: 52,
  borderRadius: BORDER_RADIUS.md,
  borderWidth: 1,
  borderColor: COLORS.border,
  backgroundColor: COLORS.surface,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: SPACING.sm,
},

googleButtonText: {
  color: COLORS.textPrimary,
  fontSize: FONT_SIZE.md,
  fontWeight: '600',
},
});
