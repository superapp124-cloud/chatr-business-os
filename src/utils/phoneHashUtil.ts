const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Canonical phone normalization to E.164 international format.
 * Handles: +, 00 prefix, and bare digits.
 * Rejects placeholder, hash-like, and obviously invalid values.
 */
export function normalizeToInternational(phone: string, defaultCountryCode: string = '+91'): string {
  if (!phone) return '';

  const raw = phone.trim();
  const hasPlus = raw.startsWith('+');
  const hasDoubleZero = raw.startsWith('00');
  const digits = raw.replace(/\D/g, '');

  if (!digits) return '';

  let candidate = '';

  if (hasPlus) {
    candidate = `+${digits}`;
  } else if (hasDoubleZero) {
    candidate = `+${digits.substring(2)}`;
  } else if (digits.length > 10) {
    candidate = `+${digits}`;
  } else {
    const codeDigits = defaultCountryCode.replace(/\D/g, '');
    candidate = `+${codeDigits}${digits}`;
  }

  return E164_PHONE_REGEX.test(candidate) ? candidate : '';
}

// Backward-compatible alias
export const normalizePhoneNumber = normalizeToInternational;

export function isUsablePhoneNumber(phone: string | null | undefined): boolean {
  return E164_PHONE_REGEX.test((phone || '').trim());
}

// Utility for hashing phone numbers for privacy
export async function hashPhoneNumber(phone: string): Promise<string> {
  const normalized = normalizeToInternational(phone);
  const msgBuffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Update phone hash for a user profile
export async function updateUserPhoneHash(
  supabase: any,
  userId: string,
  phoneNumber: string
): Promise<void> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const phoneHash = await hashPhoneNumber(normalized);

  await supabase
    .from('profiles')
    .update({
      phone_number: normalized,
      phone_hash: phoneHash,
    })
    .eq('id', userId);
}
