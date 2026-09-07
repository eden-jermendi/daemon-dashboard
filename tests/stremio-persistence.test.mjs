import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  parseTorrentioUrl,
  serializeTorrentioConfigWithCredential,
  TorrentioConfigError,
} from "../src/features/stremio-switch/domain/torrentio/index.ts";

const SYNTHETIC_VALIDATION_TOKEN = "0123456789abcdef0123456789abcdef";

// Pure validation logic mirroring service.validateTorrentioPublicConfig
function validateTorrentioPublicConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new TorrentioConfigError(
      "INVALID_SYNTAX",
      "Expected publicConfig to be an object."
    );
  }

  if ("limit" in config && config.limit !== undefined) {
    if (
      typeof config.limit !== "number" ||
      !Number.isInteger(config.limit) ||
      config.limit <= 0
    ) {
      throw new TorrentioConfigError(
        "INVALID_OPTION_VALUE",
        "Invalid limit option: expected a positive integer."
      );
    }
  }

  const segment = serializeTorrentioConfigWithCredential(
    config,
    SYNTHETIC_VALIDATION_TOKEN
  );
  const syntheticUrl = `https://torrentio.strem.fun/${segment}/manifest.json`;
  const validated = parseTorrentioUrl(syntheticUrl);

  return validated.publicConfig;
}

// Pure DTO mapping mirroring service.toStremioProviderConfigDto
function toStremioProviderConfigDto(record) {
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
    capabilityHint: record.capability_hint ?? undefined,
    createdAt,
    updatedAt,
    isConfigured: true,
  };
}

// In-memory mock repository implementing the exact SQL contract for unit isolation
class MockStremioRepository {
  constructor() {
    this.records = [];
  }

  async getUserStremioConfigs(userId) {
    return this.records.filter((r) => r.user_id === userId);
  }

  async getUserStremioConfig(userId, providerName) {
    return this.records.find(
      (r) => r.user_id === userId && r.provider_name === providerName
    ) || null;
  }

  async getUserStremioConfigById(userId, id) {
    return this.records.find(
      (r) => r.user_id === userId && r.id === id
    ) || null;
  }

  async getStremioConfigByCapabilityHash(hash) {
    if (!hash) return null;
    return this.records.find((r) => r.capability_hash === hash) || null;
  }

  async updateStremioCapabilityHash(userId, id, capabilityHash, capabilityHint) {
    const record = this.records.find(
      (r) => r.user_id === userId && r.id === id
    );
    if (!record) return false;
    record.capability_hash = capabilityHash;
    record.capability_hint = capabilityHint;
    record.updated_at = new Date();
    return true;
  }

  async upsertStremioConfig({ userId, providerName, publicConfig }) {
    const existing = await this.getUserStremioConfig(userId, providerName);
    const now = new Date();

    if (existing) {
      existing.public_config = publicConfig;
      existing.updated_at = now;
      return existing;
    }

    const newRecord = {
      id: randomUUID(),
      user_id: userId,
      provider_name: providerName,
      public_config: publicConfig,
      capability_hash: null,
      capability_hint: null,
      created_at: now,
      updated_at: now,
    };
    this.records.push(newRecord);
    return newRecord;
  }

  async deleteUserStremioConfig(userId, id) {
    const idx = this.records.findIndex(
      (r) => r.user_id === userId && r.id === id
    );
    if (idx === -1) {
      return false;
    }
    this.records.splice(idx, 1);
    return true;
  }
}

describe("Milestone 6C — Stremio Provider Configuration Persistence", () => {
  describe("Torrentio URL Import & Credential Discarding", () => {
    it("extracts publicConfig from a full Torrentio URL and discards the credential", () => {
      const sensitiveToken = "RD_SECRET_TOKEN_NEVER_PERSIST_12345678";
      const importUrl = `https://torrentio.strem.fun/providers=yts,eztv|sort=seeders|qualityfilter=4k|realdebrid=${sensitiveToken}/manifest.json`;

      const parsed = parseTorrentioUrl(importUrl);

      // Verify domain engine parsed options
      assert.deepEqual(parsed.publicConfig.providers, ["yts", "eztv"]);
      assert.equal(parsed.publicConfig.sort, "seeders");
      assert.deepEqual(parsed.publicConfig.qualityFilters, ["4k"]);

      // Invariant: The persisted model contains ONLY publicConfig
      const toPersist = parsed.publicConfig;
      assert.equal("credential" in toPersist, false);
      assert.equal("realdebrid" in toPersist, false);
      assert.equal("secret" in toPersist, false);

      const serializedPersisted = JSON.stringify(toPersist);
      assert.equal(serializedPersisted.includes(sensitiveToken), false);
    });

    it("rejects non-HTTPS and non-torrentio hosts during URL import", () => {
      assert.throws(
        () => parseTorrentioUrl("http://torrentio.strem.fun/realdebrid=abc/manifest.json"),
        (err) => err instanceof TorrentioConfigError && err.code === "UNSUPPORTED_SCHEME"
      );

      assert.throws(
        () => parseTorrentioUrl("https://evil.com/realdebrid=abc/manifest.json"),
        (err) => err instanceof TorrentioConfigError && err.code === "UNSUPPORTED_HOST"
      );
    });
  });

  describe("Public Configuration Validation", () => {
    it("validates a structured public configuration against Torrentio vocabulary", () => {
      const validConfig = {
        providers: ["yts", "rarbg", "1337x"],
        sort: "qualitysize",
        priorityLanguages: ["french", "german"],
        qualityFilters: ["scr", "cam"],
        limit: 10,
        debridOptions: ["nodownloadlinks"],
      };

      const result = validateTorrentioPublicConfig(validConfig);
      assert.deepEqual(result.providers, ["yts", "rarbg", "1337x"]);
      assert.equal(result.sort, "qualitysize");
      assert.deepEqual(result.priorityLanguages, ["french", "german"]);
      assert.deepEqual(result.qualityFilters, ["scr", "cam"]);
      assert.equal(result.limit, 10);
      assert.deepEqual(result.debridOptions, ["nodownloadlinks"]);
    });

    it("rejects malformed public configurations with unknown providers", () => {
      assert.throws(
        () => validateTorrentioPublicConfig({ providers: ["unsupported_tracker"] }),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
      );
    });

    it("rejects invalid sort options", () => {
      assert.throws(
        () => validateTorrentioPublicConfig({ sort: "fastest_stream" }),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
      );
    });

    it("rejects invalid limit values", () => {
      assert.throws(
        () => validateTorrentioPublicConfig({ limit: -1 }),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
      );
      assert.throws(
        () => validateTorrentioPublicConfig({ limit: 0 }),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
      );
    });

    it("rejects invalid debrid options", () => {
      assert.throws(
        () => validateTorrentioPublicConfig({ debridOptions: ["unknown_opt"] }),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
      );
    });
  });

  describe("Public DTO Shape & Secret Containment", () => {
    it("ensures public DTO strips user_id, contains zero credentials, and never exposes capability_hash or raw capability", () => {
      const record = {
        id: "cf100000-0000-4000-8000-000000000001",
        user_id: "usr_secret_daemon_owner_999",
        provider_name: "torrentio",
        public_config: { providers: ["yts"], sort: "quality" },
        capability_hash: "a3f5b72e81d4c90a12e345f67890123456789abcdef0123456789abcdef01234",
        capability_hint: "st_9xK2...4pLm",
        created_at: new Date("2026-09-07T00:00:00Z"),
        updated_at: new Date("2026-09-07T01:00:00Z"),
      };

      const dto = toStremioProviderConfigDto(record);

      assert.equal(dto.id, "cf100000-0000-4000-8000-000000000001");
      assert.equal(dto.providerName, "torrentio");
      assert.deepEqual(dto.publicConfig, { providers: ["yts"], sort: "quality" });
      assert.equal(dto.capabilityConfigured, true);
      assert.equal(dto.capabilityHint, "st_9xK2...4pLm");
      assert.equal(dto.isConfigured, true);
      assert.equal(dto.createdAt, "2026-09-07T00:00:00.000Z");
      assert.equal(dto.updatedAt, "2026-09-07T01:00:00.000Z");

      // Critical secret containment checks:
      // Never expose capability_hash or plaintext proxyId/capability in DTO
      assert.equal("capability_hash" in dto, false);
      assert.equal("capabilityHash" in dto, false);
      assert.equal("proxy_id" in dto, false);
      assert.equal("proxyId" in dto, false);
      assert.equal("capability" in dto, false);
      assert.equal("user_id" in dto, false);
      assert.equal("userId" in dto, false);
      assert.equal("secret" in dto, false);
      assert.equal("token" in dto, false);
      assert.equal("access_token" in dto, false);
      assert.equal("refresh_token" in dto, false);
    });

    it("correctly indicates unconfigured capability when capability_hash is null", () => {
      const unconfiguredRecord = {
        id: "cf100000-0000-4000-8000-000000000002",
        user_id: "usr_user_2",
        provider_name: "torrentio",
        public_config: {},
        capability_hash: null,
        capability_hint: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const dto = toStremioProviderConfigDto(unconfiguredRecord);
      assert.equal(dto.capabilityConfigured, false);
      assert.equal(dto.capabilityHint, undefined);
    });
  });

  describe("Repository & Ownership Enforcement", () => {
    it("enforces strict user ownership on lookups", async () => {
      const repo = new MockStremioRepository();

      const user1 = "user_alpha";
      const user2 = "user_beta";

      const r1 = await repo.upsertStremioConfig({
        userId: user1,
        providerName: "torrentio",
        publicConfig: { sort: "seeders" },
      });

      // User 1 can retrieve their config
      const found1 = await repo.getUserStremioConfigById(user1, r1.id);
      assert.ok(found1);
      assert.equal(found1.id, r1.id);

      // User 2 cannot retrieve User 1's config by ID
      const notFoundForUser2 = await repo.getUserStremioConfigById(user2, r1.id);
      assert.equal(notFoundForUser2, null);

      // User 2's list does not contain User 1's config
      const user2List = await repo.getUserStremioConfigs(user2);
      assert.equal(user2List.length, 0);
    });

    it("preserves capability hash on configuration update (upsert)", async () => {
      const repo = new MockStremioRepository();
      const userId = "user_alpha";

      const firstSave = await repo.upsertStremioConfig({
        userId,
        providerName: "torrentio",
        publicConfig: { sort: "quality" },
      });

      // Set a capability hash
      const sampleHash = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const sampleHint = "st_1234...cdef";
      await repo.updateStremioCapabilityHash(userId, firstSave.id, sampleHash, sampleHint);

      // Update the configuration
      const updatedSave = await repo.upsertStremioConfig({
        userId,
        providerName: "torrentio",
        publicConfig: { sort: "seeders", providers: ["yts"] },
      });

      // Invariant: capability_hash must NOT change on update so installed add-on URLs remain valid
      assert.equal(updatedSave.capability_hash, sampleHash);
      assert.equal(updatedSave.capability_hint, sampleHint);
      assert.deepEqual(updatedSave.public_config, { sort: "seeders", providers: ["yts"] });
    });

    it("enforces user ownership on deletion", async () => {
      const repo = new MockStremioRepository();
      const user1 = "user_alpha";
      const user2 = "user_beta";

      const record = await repo.upsertStremioConfig({
        userId: user1,
        providerName: "torrentio",
        publicConfig: { sort: "quality" },
      });

      // User 2 cannot delete User 1's record
      const unauthorizedDelete = await repo.deleteUserStremioConfig(user2, record.id);
      assert.equal(unauthorizedDelete, false);

      // Record still exists for User 1
      const stillThere = await repo.getUserStremioConfigById(user1, record.id);
      assert.ok(stillThere);

      // User 1 can delete their own record
      const authorizedDelete = await repo.deleteUserStremioConfig(user1, record.id);
      assert.equal(authorizedDelete, true);

      // Record is gone
      const deleted = await repo.getUserStremioConfigById(user1, record.id);
      assert.equal(deleted, null);
    });

    it("allows server-internal lookup by capability_hash", async () => {
      const repo = new MockStremioRepository();
      const userId = "user_alpha";

      const record = await repo.upsertStremioConfig({
        userId,
        providerName: "torrentio",
        publicConfig: { sort: "quality" },
      });

      const hash = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
      const hint = "st_abcd...6789";
      await repo.updateStremioCapabilityHash(userId, record.id, hash, hint);

      const found = await repo.getStremioConfigByCapabilityHash(hash);
      assert.ok(found);
      assert.equal(found.id, record.id);
      assert.equal(found.user_id, userId);

      const notFound = await repo.getStremioConfigByCapabilityHash("nonexistent_hash");
      assert.equal(notFound, null);
    });

    it("supports capability revocation by clearing hash and hint", async () => {
      const repo = new MockStremioRepository();
      const userId = "user_alpha";

      const record = await repo.upsertStremioConfig({
        userId,
        providerName: "torrentio",
        publicConfig: { sort: "quality" },
      });

      const hash = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
      await repo.updateStremioCapabilityHash(userId, record.id, hash, "st_hint");

      // Verify active
      const before = await repo.getStremioConfigByCapabilityHash(hash);
      assert.ok(before);

      // Revoke
      await repo.updateStremioCapabilityHash(userId, record.id, null, null);

      // Verify revoked
      const after = await repo.getStremioConfigByCapabilityHash(hash);
      assert.equal(after, null);
    });
  });
});
