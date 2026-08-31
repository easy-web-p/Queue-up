/**
 * Encryption / Decryption Utility for User Data (JavaScript)
 * Uses Web Crypto API (AES-GCM 256-bit) for client-side and payload encryption.
 */

const ENCRYPTION_KEY_STRING = 'QueueUp_School_Food_CRM_SecureKey_2026';

async function getKey() {
  const enc = new TextEncoder();
  const keyData = enc.encode(ENCRYPTION_KEY_STRING);
  const hash = await crypto.subtle.digest('SHA-256', keyData);
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt any object or string into a base64 encrypted payload
 */
export async function encryptData(data) {
  try {
    const jsonStr = JSON.stringify(data);
    const enc = new TextEncoder();
    const encoded = enc.encode(jsonStr);

    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    let binary = '';
    const bytes = combined;
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error('Encryption failed:', error);
    return JSON.stringify(data);
  }
}

/**
 * Decrypt base64 payload back into original object or string
 */
export async function decryptData(encryptedBase64) {
  try {
    if (!encryptedBase64) return null;

    if (encryptedBase64.startsWith('{') || encryptedBase64.startsWith('[')) {
      return JSON.parse(encryptedBase64);
    }

    const binary = atob(encryptedBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);

    const key = await getKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decrypted);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Decryption failed:', error);
    try {
      return JSON.parse(encryptedBase64);
    } catch {
      return null;
    }
  }
}

/**
 * Hash password or sensitive field using SHA-256
 */
export async function hashSensitive(value) {
  const enc = new TextEncoder();
  const data = enc.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const encryptDataAES = encryptData;
export const hashPassword = hashSensitive;
