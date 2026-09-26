/**
 * Phone number OTP verification via Firebase Phone Auth.
 *
 * This is used ONLY to prove the user has access to a phone number — the
 * actual StoreFlow account still lives entirely in Supabase. Once a number
 * is verified here, we create/update the Supabase account directly (see
 * context/AuthContext.tsx) without Supabase ever sending its own SMS, so
 * this stays within Firebase's free daily SMS quota.
 *
 * Free tier: 10 SMS/day. Beyond that Firebase requires live billing — see
 * the app's README/notes for what happens if you exceed it.
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

export interface SendOtpResult {
  success: boolean;
  confirmation?: FirebaseAuthTypes.ConfirmationResult;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  error?: string;
}

/** Converts a plain 10-digit Indian number to E.164 (+91...) if needed. */
export function toE164(rawPhone: string, defaultCountryCode = '+91'): string {
  const trimmed = rawPhone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digitsOnly = trimmed.replace(/\D/g, '');
  return `${defaultCountryCode}${digitsOnly}`;
}

/** Sends an OTP SMS to the given E.164 phone number. */
export async function sendPhoneOtp(phoneNumber: string): Promise<SendOtpResult> {
  try {
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    return { success: true, confirmation };
  } catch (err: any) {
    return { success: false, error: friendlyFirebaseError(err) };
  }
}

/** Confirms the code the user typed against the pending confirmation. */
export async function confirmPhoneOtp(
  confirmation: FirebaseAuthTypes.ConfirmationResult,
  code: string
): Promise<VerifyOtpResult> {
  try {
    await confirmation.confirm(code.trim());
    // We only needed Firebase to prove ownership of the number — the real
    // account lives in Supabase, so sign back out of the Firebase session
    // immediately rather than keeping two parallel identity providers alive.
    await auth().signOut();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: friendlyFirebaseError(err) };
  }
}

function friendlyFirebaseError(err: any): string {
  const code = err?.code || '';
  if (code.includes('invalid-phone-number')) return 'Enter a valid phone number.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Try again later.';
  if (code.includes('invalid-verification-code')) return 'Incorrect code. Please try again.';
  if (code.includes('code-expired')) return 'This code has expired. Request a new one.';
  if (code.includes('quota-exceeded')) return "Today's free verification limit has been reached. Try again tomorrow.";
  return err?.message || 'Something went wrong. Please try again.';
}
