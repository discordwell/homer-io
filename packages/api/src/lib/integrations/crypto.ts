import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { config } from '../../config.js';

/**
 * Minimum passphrase length for INTEGRATION_ENCRYPTION_KEY.
 *
 * We SHA-256-derive a 32-byte AES-256-GCM key from this passphrase, so a short
 * passphrase wouldn't break the key *length* — but it would make the key
 * easily bruteforceable. Require ≥32 characters of entropy so the derived key
 * has meaningful secrecy. A hex-encoded 32-byte random value (64 chars) or a
 * base64-encoded 32-byte random value (~44 chars) both satisfy this trivially.
 */
export const MIN_ENCRYPTION_KEY_LENGTH = 32;

/**
 * Validate the passphrase and derive the 32-byte AES-256-GCM key via SHA-256.
 * Throws synchronously on missing/short keys so misconfiguration fails at the
 * first crypto call rather than silently producing garbage ciphertext.
 */
function deriveKey(key: string): Buffer {
  if (!key) {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY is required (no fallback allowed). Generate with: openssl rand -hex 32',
    );
  }
  if (key.length < MIN_ENCRYPTION_KEY_LENGTH) {
    throw new Error(
      `INTEGRATION_ENCRYPTION_KEY must be at least ${MIN_ENCRYPTION_KEY_LENGTH} characters (got ${key.length}). Generate with: openssl rand -hex 32`,
    );
  }
  return createHash('sha256').update(key).digest();
}

function resolveKey(override?: string): string {
  const encKey = override || config.integrations.encryptionKey;
  if (!encKey) {
    // Defence in depth: config.ts already enforces this at startup, but keep
    // this check so any call path that bypasses the config (tests, future
    // refactors) still fails loudly instead of using a hardcoded fallback.
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY is required (no fallback allowed). Generate with: openssl rand -hex 32',
    );
  }
  return encKey;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded string in format: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string, key?: string): string {
  const derivedKey = deriveKey(resolveKey(key));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: base64(iv):base64(authTag):base64(ciphertext)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt a string encrypted by encrypt().
 */
export function decrypt(encrypted: string, key?: string): string {
  const derivedKey = deriveKey(resolveKey(key));
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
