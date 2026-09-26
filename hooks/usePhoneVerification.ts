import { useState } from 'react';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { sendPhoneOtp, confirmPhoneOtp, toE164 } from '../lib/firebaseAuth';

type Step = 'enter-phone' | 'enter-code';

export function usePhoneVerification() {
  const [step, setStep] = useState<Step>('enter-phone');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  async function sendCode(rawPhone: string) {
    setError('');
    if (!rawPhone.trim()) {
      setError('Enter a phone number');
      return false;
    }
    setLoading(true);
    const e164 = toE164(rawPhone);
    const result = await sendPhoneOtp(e164);
    setLoading(false);
    if (!result.success || !result.confirmation) {
      setError(result.error || 'Could not send code. Please try again.');
      return false;
    }
    setPhone(e164);
    setConfirmation(result.confirmation);
    setStep('enter-code');
    return true;
  }

  async function verifyCode(code: string) {
    setError('');
    if (!confirmation) {
      setError('Request a code first.');
      return false;
    }
    setLoading(true);
    const result = await confirmPhoneOtp(confirmation, code);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Verification failed.');
      return false;
    }
    return true;
  }

  function reset() {
    setStep('enter-phone');
    setPhone('');
    setError('');
    setConfirmation(null);
  }

  return { step, phone, loading, error, sendCode, verifyCode, reset, setError };
}
