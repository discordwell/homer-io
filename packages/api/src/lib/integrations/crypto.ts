import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { config } from '../../config.js';

function deriveKey(key: string): Buffer {
  return createHash('sha256').update(key).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded string in format: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string, key?: string): string {
  const encKey = key || config.integrations.encryptionKey;
  if (!encKey) {
    if (config.nodeEnv === 'production') {
      throw new Error('INTEGRATION_ENCRYPTION_KEY is required in production');
    }
    console.warn('[integrations] No encryption key configured — using fallback dev key');
  }
  const derivedKey = deriveKey(encKey || 'homer-dev-encryption-key-do-not-use-in-prod');
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
  const encKey = key || config.integrations.encryptionKey;
  if (!encKey && config.nodeEnv === 'production') {
    throw new Error('INTEGRATION_ENCRYPTION_KEY is required in production');
  }
  const derivedKey = deriveKey(encKey || 'homer-dev-encryption-key-do-not-use-in-prod');
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
