/**
 * ============================================================================
 * 🆔 ACCOUNT CODE — a reference a person can read out loud
 * ============================================================================
 *
 * The profile shows a "รหัสบัญชี". What it used to show was none of the things
 * it looked like.
 *
 * It was masked behind `••••••••••••••••` with an eye toggle, which teaches a
 * user it is a secret. It is not: nothing authenticates with it, nothing looks
 * anything up by it, and the whole value was handed out by a copy button one
 * row below the mask.
 *
 * It was editable, behind a modal titled "ยืนยันตัวตนด้วยรหัสผ่าน" that checked
 * only that the password box was non-empty and then reported
 * "ยืนยันรหัสผ่านสำเร็จ!" — on accounts that sign in with Google and have no
 * password to type. A verification that verifies nothing and then announces
 * success is worse than no verification, because someone reading the screen
 * now believes a check happened.
 *
 * And it was not stable. `generateSecureAccountId` built it from the current
 * date and time, a "sequential user index" that was the literal constant 58140
 * (or, on the Google path, whatever digits happened to be in the email
 * address), and 32 bits of entropy under a comment claiming 128. On the
 * email-login path it was regenerated whenever the profile document lacked the
 * field and written only to localStorage — so the "account code" the profile
 * displayed was a different string on every login, and a different string on
 * every device.
 *
 * What a code like this is actually for in a school canteen is being read to a
 * member of staff: "my order did not arrive, my code is QUP-7K3M-QH42". That
 * asks for exactly three properties, which is what this module provides:
 *
 *  1. **Stable.** Derived from the uid, so it is the same string on every
 *     device, on every login, forever, with no stored field to drift from.
 *  2. **Unique.** Two different uids give two different codes, up to the
 *     collision rate of the digest below rather than of a clock minute.
 *  3. **Readable aloud.** No characters that are heard or written wrong: the
 *     alphabet drops 0/O, 1/I/L and the vowels that let it spell words.
 *
 * It is deliberately NOT a secret and must never become one. It is derived
 * from the uid, so anyone holding the uid can compute it; that is fine for a
 * reference number and disqualifying for a credential.
 */

/**
 * Crockford-style alphabet minus the vowels.
 *
 * No O/0 or I/1/L confusion when a child reads it to canteen staff over a
 * counter, and no vowels, so a code cannot come out as a word nobody wants
 * printed on a school screen.
 */
const ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ';

/** Bit width one character carries, used only to decide how many to emit. */
const GROUPS = 2;
const GROUP_LENGTH = 4;

/**
 * FNV-1a, 32-bit, run twice over different seeds.
 *
 * Not a cryptographic hash and not claimed to be one — the point here is a
 * stable, well-spread mapping from a uid to a short string, and the input is
 * not secret. Two rounds with different offset bases give the 40 bits the eight
 * characters below consume, which is what keeps distinct uids apart.
 */
function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // The FNV prime, 16777619, by shift-and-add so it stays in 32 bits.
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The account code for a uid: "QUP-XXXX-XXXX", or null when there is no uid.
 *
 * Null rather than a placeholder, so a caller that does not know who it is
 * looking at shows "not known yet" instead of a code that belongs to nobody.
 */
export function deriveAccountCode(uid: string | null | undefined): string | null {
  if (typeof uid !== 'string' || uid.trim() === '') return null;
  const key = uid.trim();

  // Two independent rounds, so the second group is not a function of the first.
  let bits = BigInt(fnv1a(key, 0x811c9dc5)) * 4294967296n + BigInt(fnv1a(key, 0x01000193));

  const chars: string[] = [];
  const size = BigInt(ALPHABET.length);
  for (let i = 0; i < GROUPS * GROUP_LENGTH; i += 1) {
    chars.push(ALPHABET[Number(bits % size)]);
    bits /= size;
  }

  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g += 1) {
    groups.push(chars.slice(g * GROUP_LENGTH, (g + 1) * GROUP_LENGTH).join(''));
  }
  return `QUP-${groups.join('-')}`;
}

/** Whether a string is shaped like a code this module would produce. */
export function isAccountCode(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return new RegExp(`^QUP(-[${ALPHABET}]{${GROUP_LENGTH}}){${GROUPS}}$`).test(value);
}
