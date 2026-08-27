import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // 96 bits recommended for AES-GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128 bits

/**
 * Derives a 32-byte Buffer key from the environment variable PROVIDER_TOKEN_ENCRYPTION_KEY.
 * Supports 64-char hex strings, 44-char base64 strings, or 32-byte UTF-8 strings.
 */
export function getEncryptionKey(overrideKey?: string): Buffer {
  const rawKey = overrideKey || process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error(
      "PROVIDER_TOKEN_ENCRYPTION_KEY is not configured in the environment. " +
      "Generate a secure key using: openssl rand -hex 32"
    );
  }

  const trimmed = rawKey.trim();

  // 64 hex characters -> 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  // Check base64
  const base64Buffer = Buffer.from(trimmed, "base64");
  if (base64Buffer.length === 32) {
    return base64Buffer;
  }

  // Check utf-8 string
  const utf8Buffer = Buffer.from(trimmed, "utf-8");
  if (utf8Buffer.length === 32) {
    return utf8Buffer;
  }

  throw new Error(
    "PROVIDER_TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (256 bits). " +
    "Recommended format: 64-character hex string (e.g. from openssl rand -hex 32)."
  );
}

/**
 * Encrypts a plaintext string (such as an OAuth access or refresh token) using AES-256-GCM.
 * Output format: <iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */
export function encryptToken(plaintext: string, overrideKey?: string): string {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty token plaintext.");
  }

  const key = getEncryptionKey(overrideKey);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an encrypted token payload produced by encryptToken().
 * Performs authenticated decryption (verifies auth tag to prevent tampering).
 */
export function decryptToken(payload: string, overrideKey?: string): string {
  if (!payload) {
    throw new Error("Cannot decrypt empty token payload.");
  }

  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token payload format. Expected iv:tag:ciphertext.");
  }

  const [ivHex, tagHex, ciphertextHex] = parts;
  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new Error("Invalid encrypted token payload components.");
  }

  const key = getEncryptionKey(overrideKey);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error("Invalid IV length in encrypted token payload.");
  }
  if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error("Invalid authentication tag length in encrypted token payload.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
