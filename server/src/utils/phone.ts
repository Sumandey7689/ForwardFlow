export interface NormalizedPhoneDestination {
  jid: string;
  digits: string;
  formatted: string;
  rawInput: string;
}

/**
 * Normalizes a phone number to WhatsApp JID format (@s.whatsapp.net).
 * If a 10-digit number without country code is provided, defaults to India (+91).
 */
export function normalizePhoneNumber(input: string): NormalizedPhoneDestination {
  if (!input || typeof input !== 'string') {
    throw new Error('Phone number must be a non-empty string');
  }

  // Remove whitespace, dashes, dots, brackets
  let cleaned = input.trim().replace(/[\s\-\(\)\.]/g, '');

  // Strip leading plus
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Strip leading 0 if 11 digits (e.g. 09876543210 -> 9876543210)
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // If 10 digits, automatically prepend 91 (India)
  if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
    cleaned = '91' + cleaned;
  }

  // Validate: Must be digits only and between 10 and 15 digits
  if (!/^\d{10,15}$/.test(cleaned)) {
    throw new Error(
      `Invalid phone number: "${input}". Please enter a valid 10-digit number or international format with country code.`
    );
  }

  const jid = `${cleaned}@s.whatsapp.net`;

  // Prettify for display
  let formatted: string;
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    formatted = `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  } else {
    formatted = `+${cleaned}`;
  }

  return {
    jid,
    digits: cleaned,
    formatted,
    rawInput: input,
  };
}

/**
 * Parses multiple phone numbers separated by commas, spaces, semicolons, or newlines.
 */
export function parseMultiplePhoneNumbers(inputs: string | string[]): NormalizedPhoneDestination[] {
  let list: string[] = [];
  if (Array.isArray(inputs)) {
    for (const item of inputs) {
      if (typeof item === 'string') {
        const split = item.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
        list.push(...split);
      }
    }
  } else if (typeof inputs === 'string') {
    list = inputs.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  }

  const results: NormalizedPhoneDestination[] = [];
  const seenJids = new Set<string>();

  for (const raw of list) {
    const normalized = normalizePhoneNumber(raw);
    if (!seenJids.has(normalized.jid)) {
      seenJids.add(normalized.jid);
      results.push(normalized);
    }
  }

  return results;
}
