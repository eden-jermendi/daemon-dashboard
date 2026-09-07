import { createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "st_";
const CAPABILITY_REGEX = /^st_[A-Za-z0-9_-]{35,60}$/;
const MAX_TOKEN_LENGTH = 64;
const MIN_TOKEN_LENGTH = 40;

/**
 * Generates a high-entropy, cryptographically secure URL-safe Stremio capability token.
 * Generates 32 random bytes (256 bits of entropy) encoded as base64url with prefix `st_`.
 */
export function generateStremioCapability(): string {
  const bytes = randomBytes(32);
  const encoded = bytes.toString("base64url");
  return `${TOKEN_PREFIX}${encoded}`;
}

/**
 * Computes a deterministic lowercase hex SHA-256 digest of the capability token.
 * Stored in Postgres capability_hash column; plaintext token is never persisted.
 */
export function hashStremioCapability(token: string): string {
  if (!token || typeof token !== "string") {
    throw new Error("Cannot hash invalid capability token.");
  }
  return createHash("sha256").update(token.trim()).digest("hex").toLowerCase();
}

/**
 * Extracts a non-sensitive display hint from a capability token for UI glanceability.
 * Example: 'st_Ab12...9Zyx'
 */
export function formatCapabilityHint(token: string): string {
  if (!token || typeof token !== "string" || token.length < 12) {
    return "st_configured";
  }
  const clean = token.trim();
  const prefix = clean.slice(0, 7);
  const suffix = clean.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Strictly validates whether an incoming path parameter is a valid capability token shape.
 * Performs fast length and character bounds checks to reject invalid or oversized inputs early.
 */
export function isValidCapabilityToken(token: unknown): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }

  const trimmed = token.trim();
  if (
    trimmed.length < MIN_TOKEN_LENGTH ||
    trimmed.length > MAX_TOKEN_LENGTH ||
    !trimmed.startsWith(TOKEN_PREFIX)
  ) {
    return false;
  }

  return CAPABILITY_REGEX.test(trimmed);
}
