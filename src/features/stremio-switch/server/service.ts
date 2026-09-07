import "server-only";
import {
  formatCapabilityHint,
  generateStremioCapability,
  hashStremioCapability,
  isValidCapabilityToken,
  parseTorrentioUrl,
  serializeTorrentioConfigWithCredential,
} from "../domain/torrentio/index.ts";
import { TorrentioConfigError } from "../domain/torrentio/errors.ts";
import type { TorrentioPublicConfig } from "../domain/torrentio/types.ts";
import * as repository from "./repository.ts";
import type {
  ImportTorrentioUrlInput,
  RotateCapabilityResult,
  StremioProviderConfigDto,
  StremioProviderConfigRecord,
} from "./types.ts";

// Synthetic 32-character hex token used solely for validating public option objects through the domain parser
const SYNTHETIC_VALIDATION_TOKEN = "0123456789abcdef0123456789abcdef";

/**
 * Validates a structured public configuration against the canonical Torrentio domain engine.
 * Avoids duplicating vocabulary, length, or boundary validation rules.
 */
export function validateTorrentioPublicConfig(config: unknown): TorrentioPublicConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new TorrentioConfigError(
      "INVALID_SYNTAX",
      "Expected publicConfig to be an object."
    );
  }

  const record = config as Record<string, unknown>;

  if ("limit" in record && record.limit !== undefined) {
    if (
      typeof record.limit !== "number" ||
      !Number.isInteger(record.limit) ||
      record.limit <= 0
    ) {
      throw new TorrentioConfigError(
        "INVALID_OPTION_VALUE",
        "Invalid limit option: expected a positive integer."
      );
    }
  }

  const typedConfig = config as TorrentioPublicConfig;

  // Reconstruct a synthetic HTTPS URL containing the options and a dummy token, then parse
  const segment = serializeTorrentioConfigWithCredential(
    typedConfig,
    SYNTHETIC_VALIDATION_TOKEN
  );
  const syntheticUrl = `https://torrentio.strem.fun/${segment}/manifest.json`;
  const validated = parseTorrentioUrl(syntheticUrl);

  return validated.publicConfig;
}

/**
 * Transforms a raw database record into a safe, redacted public DTO.
 * Explicitly strips user_id and contains zero provider credentials or capability hashes.
 */
export function toStremioProviderConfigDto(
  record: StremioProviderConfigRecord
): StremioProviderConfigDto {
  const createdAt = record.created_at instanceof Date
    ? record.created_at.toISOString()
    : new Date(record.created_at).toISOString();

  const updatedAt = record.updated_at instanceof Date
    ? record.updated_at.toISOString()
    : new Date(record.updated_at).toISOString();

  return {
    id: record.id,
    providerName: record.provider_name,
    publicConfig: record.public_config,
    capabilityConfigured: Boolean(record.capability_hash),
    capabilityHint: record.capability_hint ?? null,
    createdAt,
    updatedAt,
    isConfigured: true,
  };
}

/**
 * Imports an existing full Torrentio URL (e.g. from an existing Stremio installation).
 * Parses options through domain engine and STRICTLY DISCARDS any supplied provider credential.
 * Only non-secret publicConfig is persisted.
 */
export async function importTorrentioConfigFromUrl(
  input: ImportTorrentioUrlInput
): Promise<StremioProviderConfigDto> {
  const { userId, url } = input;
  if (!userId) {
    throw new Error("Authentication required.");
  }

  // 1. Parse and validate through domain engine
  const validated = parseTorrentioUrl(url);

  // 2. CRITICAL INVARIANT: The parsed credential (validated.credential) is intentionally discarded.
  // We persist ONLY publicConfig. Live RD credentials are dynamically resolved at runtime from RD OAuth.
  const publicConfig = validated.publicConfig;

  // 3. Persist publicConfig to database
  const record = await repository.upsertStremioConfig({
    userId,
    providerName: "torrentio",
    publicConfig,
  });

  return toStremioProviderConfigDto(record);
}

/**
 * Validates and saves a structured public Torrentio configuration for the user.
 */
export async function saveTorrentioPublicConfig(params: {
  userId: string;
  publicConfig: unknown;
}): Promise<StremioProviderConfigDto> {
  const { userId, publicConfig: rawConfig } = params;
  if (!userId) {
    throw new Error("Authentication required.");
  }

  const validatedPublicConfig = validateTorrentioPublicConfig(rawConfig);

  const record = await repository.upsertStremioConfig({
    userId,
    providerName: "torrentio",
    publicConfig: validatedPublicConfig,
  });

  return toStremioProviderConfigDto(record);
}

/**
 * Lists all Stremio provider configurations for the authenticated user.
 */
export async function listUserStremioConfigs(
  userId: string
): Promise<StremioProviderConfigDto[]> {
  if (!userId) return [];
  const records = await repository.getUserStremioConfigs(userId);
  return records.map(toStremioProviderConfigDto);
}

/**
 * Gets a specific Stremio provider configuration for the user by provider name.
 */
export async function getUserStremioConfig(
  userId: string,
  providerName: string
): Promise<StremioProviderConfigDto | null> {
  if (!userId) return null;
  const record = await repository.getUserStremioConfig(userId, providerName);
  return record ? toStremioProviderConfigDto(record) : null;
}

/**
 * Deletes a Stremio provider configuration by ID, enforcing user ownership.
 */
export async function deleteUserStremioConfig(
  userId: string,
  id: string
): Promise<boolean> {
  if (!userId || !id) return false;
  return repository.deleteUserStremioConfig(userId, id);
}

/**
 * Finds a Stremio configuration record by its raw capability token.
 * Validates token shape, computes SHA-256 digest, and performs an indexed lookup.
 * Fails closed on malformed or nonexistent tokens.
 */
export async function findConfigByCapabilityToken(
  token: string
): Promise<StremioProviderConfigRecord | null> {
  if (!isValidCapabilityToken(token)) {
    return null;
  }
  const hash = hashStremioCapability(token);
  return repository.getStremioConfigByCapabilityHash(hash);
}

/**
 * Generates a new cryptographically random capability token, hashes it with SHA-256,
 * and stores ONLY the hash in the database, invalidating any previous capability immediately.
 * Returns the plaintext capability token once to the caller.
 */
export async function rotateStremioCapability(
  userId: string,
  id: string
): Promise<RotateCapabilityResult> {
  if (!userId || !id) {
    throw new Error("Authentication required.");
  }

  const capability = generateStremioCapability();
  const hash = hashStremioCapability(capability);
  const hint = formatCapabilityHint(capability);

  const updated = await repository.updateStremioCapabilityHash(
    userId,
    id,
    hash,
    hint
  );

  if (!updated) {
    throw new Error("Configuration not found or unauthorized.");
  }

  return {
    capability,
    capabilityHint: hint,
  };
}

/**
 * Revokes an existing capability token by setting hash and hint to null.
 * Existing URLs immediately fail public resolution with a generic 404.
 */
export async function revokeStremioCapability(
  userId: string,
  id: string
): Promise<boolean> {
  if (!userId || !id) {
    return false;
  }

  return repository.updateStremioCapabilityHash(userId, id, null, null);
}
