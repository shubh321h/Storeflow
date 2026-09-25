/**
 * Email validation via AbstractAPI's Email Validation API.
 * https://www.abstractapi.com/api/email-verification-validation-api
 *
 * Requires EXPO_PUBLIC_ABSTRACT_EMAIL_VALIDATION_KEY to be set in your .env
 * (get a key from the "Email Validation" product in your AbstractAPI dashboard —
 * not the IP Intelligence one).
 */

const API_URL = 'https://emailvalidation.abstractapi.com/v1/';
const API_KEY = process.env.EXPO_PUBLIC_ABSTRACT_EMAIL_VALIDATION_KEY;

export interface EmailValidationResult {
  isValid: boolean;
  reason?: string;
  // Raw fields from AbstractAPI, in case the caller wants finer-grained detail.
  deliverability?: 'DELIVERABLE' | 'UNDELIVERABLE' | 'UNKNOWN';
  isFreeEmail?: boolean;
  isDisposableEmail?: boolean;
  isRoleEmail?: boolean;
  qualityScore?: number;
}

/**
 * Calls AbstractAPI to check whether an email address is real/deliverable.
 * Fails "open" (treats the email as valid) if the API key is missing or the
 * request errors out, so a third-party outage never blocks signup.
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const trimmed = email.trim();

  // Basic format check first — cheap, and avoids burning API calls on obviously bad input.
  const FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!FORMAT_REGEX.test(trimmed)) {
    return { isValid: false, reason: 'Enter a valid email address' };
  }

  if (!API_KEY) {
    console.warn('EXPO_PUBLIC_ABSTRACT_EMAIL_VALIDATION_KEY is not set — skipping remote email validation');
    return { isValid: true };
  }

  try {
    const url = `${API_URL}?api_key=${API_KEY}&email=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn('AbstractAPI email validation request failed:', response.status);
      return { isValid: true }; // fail open
    }

    const data = await response.json();

    const deliverability = data.deliverability as EmailValidationResult['deliverability'];
    const isDisposableEmail = Boolean(data.is_disposable_email?.value);
    const qualityScore = data.quality_score !== undefined ? Number(data.quality_score) : undefined;

    // Treat clearly-undeliverable or disposable addresses as invalid;
    // "UNKNOWN" deliverability is common for valid domains with strict mail
    // servers, so don't block signup on that alone.
    if (deliverability === 'UNDELIVERABLE') {
      return {
        isValid: false,
        reason: 'This email address looks undeliverable',
        deliverability,
        isDisposableEmail,
        qualityScore,
      };
    }

    if (isDisposableEmail) {
      return {
        isValid: false,
        reason: 'Disposable email addresses are not allowed',
        deliverability,
        isDisposableEmail,
        qualityScore,
      };
    }

    return {
      isValid: true,
      deliverability,
      isFreeEmail: Boolean(data.is_free_email?.value),
      isDisposableEmail,
      isRoleEmail: Boolean(data.is_role_email?.value),
      qualityScore,
    };
  } catch (err) {
    console.warn('AbstractAPI email validation error:', err);
    return { isValid: true }; // fail open — don't block signup on a network hiccup
  }
}
