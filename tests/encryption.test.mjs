import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

function deriveKey(rawKey) {
  const trimmed = rawKey.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === 32) return base64;
  const utf8 = Buffer.from(trimmed, "utf-8");
  if (utf8.length === 32) return utf8;
  throw new Error("Invalid key length");
}

function encryptToken(plaintext, keyBuffer) {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptToken(payload, keyBuffer) {
  const [ivHex, tagHex, ciphertextHex] = payload.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

test("AES-256-GCM Token Encryption & Decryption", async (t) => {
  const testKeyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const key = deriveKey(testKeyHex);

  await t.test("successfully encrypts and decrypts a sensitive OAuth token", () => {
    const sampleToken = "rd_tok_secret_access_token_value_xyz123456789";
    const encrypted = encryptToken(sampleToken, key);

    assert.notEqual(encrypted, sampleToken);
    assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

    const decrypted = decryptToken(encrypted, key);
    assert.equal(decrypted, sampleToken);
  });

  await t.test("produces distinct ciphertexts for identical plaintext due to random IVs", () => {
    const sampleToken = "identical_token_sample";
    const enc1 = encryptToken(sampleToken, key);
    const enc2 = encryptToken(sampleToken, key);

    assert.notEqual(enc1, enc2);
    assert.equal(decryptToken(enc1, key), sampleToken);
    assert.equal(decryptToken(enc2, key), sampleToken);
  });

  await t.test("fails authenticated decryption if ciphertext or tag is tampered with", () => {
    const sampleToken = "critical_refresh_token_payload";
    const encrypted = encryptToken(sampleToken, key);
    const [ivHex, tagHex, ciphertextHex] = encrypted.split(":");

    // Flip last hex character of ciphertext
    const tamperedCiphertext = ciphertextHex.slice(0, -1) + (ciphertextHex.slice(-1) === "a" ? "b" : "a");
    const tamperedPayload = `${ivHex}:${tagHex}:${tamperedCiphertext}`;

    assert.throws(() => {
      decryptToken(tamperedPayload, key);
    });
  });
});
