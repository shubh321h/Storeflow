import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import { validateEmail } from '../lib/emailValidation';
import { usePhoneVerification } from '../hooks/usePhoneVerification';

interface RegisterScreenProps {
  onNavigate: (screen: string) => void;
}

type SignupMode = 'email' | 'phone';

export default function RegisterScreen({ onNavigate }: RegisterScreenProps) {
  const [mode, setMode] = useState<SignupMode>('email');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, registerWithPhone } = useAuth();
  const phoneVerification = usePhoneVerification();

  function switchMode(next: SignupMode) {
    setMode(next);
    setError('');
    phoneVerification.reset();
    setOtpCode('');
  }

  function validateBasicFields(requirePhone: boolean) {
    if (!name.trim() || !password.trim()) {
      setError('Please fill all fields');
      return false;
    }
    if (requirePhone ? !phone.trim() : !email.trim()) {
      setError('Please fill all fields');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    return true;
  }

  // ----- Email signup (unchanged flow: AbstractAPI format check, then
  // Supabase's own confirmation email proves ownership) -----
  async function handleEmailRegister() {
    setError('');
    if (!validateBasicFields(false)) return;

    setLoading(true);

    const emailCheck = await validateEmail(email.trim());
    if (!emailCheck.isValid) {
      setLoading(false);
      setError(emailCheck.reason || 'Please enter a valid email address');
      return;
    }

    const result = await register(name.trim(), email.trim(), password.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Registration failed');
    }
  }

  // ----- Phone signup: send OTP first, only create the account after the
  // code is confirmed -----
  async function handleSendPhoneOtp() {
    setError('');
    if (!validateBasicFields(true)) return;
    await phoneVerification.sendCode(phone.trim());
  }

  async function handleVerifyAndRegister() {
    if (!otpCode.trim()) {
      phoneVerification.setError('Enter the code you received');
      return;
    }
    const verified = await phoneVerification.verifyCode(otpCode.trim());
    if (!verified) return;

    setLoading(true);
    const result = await registerWithPhone(name.trim(), phoneVerification.phone, password.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Registration failed');
    }
  }

  const isBusy = loading || phoneVerification.loading;
  const activeError = error || phoneVerification.error;

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
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Set up your store owner account</Text>

          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'email' && styles.modeButtonActive]}
              onPress={() => switchMode('email')}
              disabled={isBusy}
            >
              <Text style={[styles.modeButtonText, mode === 'email' && styles.modeButtonTextActive]}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'phone' && styles.modeButtonActive]}
              onPress={() => switchMode('phone')}
              disabled={isBusy}
            >
              <Text style={[styles.modeButtonText, mode === 'phone' && styles.modeButtonTextActive]}>Phone</Text>
            </TouchableOpacity>
          </View>

          {activeError ? <Text style={styles.errorText}>{activeError}</Text> : null}

          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              editable={!isBusy}
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>

          {mode === 'email' ? (
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isBusy}
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>
          ) : phoneVerification.step === 'enter-phone' ? (
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!isBusy}
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>
          ) : (
            <View style={styles.otpNotice}>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.otpNoticeText}>Code sent to {phoneVerification.phone}</Text>
              <TouchableOpacity onPress={() => { phoneVerification.reset(); setOtpCode(''); }} disabled={isBusy}>
                <Text style={styles.otpChangeLink}>Change</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'phone' && phoneVerification.step === 'enter-code' && (
            <View style={styles.inputContainer}>
              <Ionicons name="keypad-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
                editable={!isBusy}
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>
          )}

          {(mode === 'email' || phoneVerification.step === 'enter-phone') && (
            <>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isBusy}
                  placeholderTextColor={COLORS.textTertiary}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  editable={!isBusy}
                  placeholderTextColor={COLORS.textTertiary}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.registerButton, isBusy && styles.disabled]}
            onPress={
              mode === 'email'
                ? handleEmailRegister
                : phoneVerification.step === 'enter-phone'
                ? handleSendPhoneOtp
                : handleVerifyAndRegister
            }
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>
                {mode === 'email'
                  ? 'Create Account'
                  : phoneVerification.step === 'enter-phone'
                  ? 'Send Code'
                  : 'Verify & Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'phone' && (
            <Text style={styles.helperText}>
              You can verify or add an email later from your account settings.
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => onNavigate('login')}>
            <Text style={styles.footerLink}>Sign In</Text>
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
    marginBottom: SPACING.xl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  appName: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
    color: COLORS.primary,
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
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  modeButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md - 2,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: COLORS.surface,
    ...SHADOW.sm,
  },
  modeButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modeButtonTextActive: {
    color: COLORS.primary,
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
  otpNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 52,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  otpNoticeText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },
  otpChangeLink: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  helperText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  registerButton: {
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
  registerButtonText: {
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
});
