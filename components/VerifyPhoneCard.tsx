import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { usePhoneVerification } from '../hooks/usePhoneVerification';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../lib/theme';

/**
 * Drop this into any settings screen. Shows nothing but a confirmation
 * badge if the signed-in user already has a verified phone; otherwise lets
 * them add and verify one via the same Firebase OTP flow used at signup.
 */
export default function VerifyPhoneCard() {
  const { user, linkVerifiedPhone } = useAuth();
  const phoneVerification = usePhoneVerification();
  const [phoneInput, setPhoneInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [done, setDone] = useState(false);

  if (!user) return null;

  if (user.phoneVerified || done) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Phone Number</Text>
        <View style={styles.verifiedRow}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
          <Text style={styles.verifiedText}>{user.phone || 'Verified'}</Text>
        </View>
      </View>
    );
  }

  async function handleSend() {
    if (!phoneInput.trim()) {
      phoneVerification.setError('Enter a phone number');
      return;
    }
    await phoneVerification.sendCode(phoneInput.trim());
  }

  async function handleVerify() {
    if (!otpCode.trim()) {
      phoneVerification.setError('Enter the code you received');
      return;
    }
    const verified = await phoneVerification.verifyCode(otpCode.trim());
    if (!verified) return;

    setLinking(true);
    const result = await linkVerifiedPhone(phoneVerification.phone);
    setLinking(false);
    if (result.success) {
      setDone(true);
    } else {
      phoneVerification.setError(result.error || 'Could not save your phone number.');
    }
  }

  const busy = phoneVerification.loading || linking;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Phone Number</Text>
      <Text style={styles.helperText}>Add and verify a phone number for your account.</Text>

      {phoneVerification.error ? <Text style={styles.errorText}>{phoneVerification.error}</Text> : null}

      {phoneVerification.step === 'enter-phone' ? (
        <>
          <TextInput
            style={styles.input}
            value={phoneInput}
            onChangeText={setPhoneInput}
            keyboardType="phone-pad"
            placeholder="Phone number"
            placeholderTextColor={COLORS.textTertiary}
            editable={!busy}
          />
          <TouchableOpacity style={[styles.button, busy && styles.disabled]} onPress={handleSend} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Code</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.sentText}>Code sent to {phoneVerification.phone}</Text>
          <TextInput
            style={styles.input}
            value={otpCode}
            onChangeText={setOtpCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit code"
            placeholderTextColor={COLORS.textTertiary}
            editable={!busy}
          />
          <TouchableOpacity style={[styles.button, busy && styles.disabled]} onPress={handleVerify} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { phoneVerification.reset(); setOtpCode(''); }} disabled={busy}>
            <Text style={styles.changeLink}>Change number</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  helperText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    height: 48,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  sentText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  changeLink: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  verifiedText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
});
