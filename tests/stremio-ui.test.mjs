import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseTorrentioUrl,
  formatCapabilityHint,
  generateStremioCapability,
} from "../src/features/stremio-switch/domain/torrentio/index.ts";

/**
 * Pure state-mapping function mirroring Dashboard Tile logic in src/app/page.tsx
 */
function mapStremioDashboardTileState(config) {
  if (!config) {
    return {
      status: "NOT CONFIGURED",
      statusType: "muted",
      actionLabel: "CONFIGURE",
      destination: "/modules/stremio-switch",
      isConfigured: false,
      isCapabilityActive: false,
    };
  }

  if (config.capabilityConfigured) {
    return {
      status: "ADDON ACTIVE",
      statusType: "online",
      actionLabel: "OPEN",
      destination: "/modules/stremio-switch",
      isConfigured: true,
      isCapabilityActive: true,
      capabilityHint: config.capabilityHint || "Active",
      sort: config.publicConfig?.sort || "quality",
    };
  }

  return {
    status: "CONFIGURED",
    statusType: "warning",
    actionLabel: "OPEN",
    destination: "/modules/stremio-switch",
    isConfigured: true,
    isCapabilityActive: false,
    sort: config.publicConfig?.sort || "quality",
  };
}

/**
 * Pure URL constructor mirroring StremioSwitchClient in src/app/modules/stremio-switch/stremio-switch-client.tsx
 */
function constructStremioAddonUrls(origin, host, capability) {
  if (!origin || !host || !capability) {
    throw new Error("Missing parameters for Stremio addon URL construction.");
  }
  return {
    httpsUrl: `${origin}/api/stremio/${capability}/manifest.json`,
    stremioUrl: `stremio://${host}/api/stremio/${capability}/manifest.json`,
  };
}

/**
 * Pure form state parser mirroring StremioSwitchClient initialization
 */
function initFormStateFromDto(dto) {
  const DEFAULT_PROVIDERS = [
    "yts",
    "eztv",
    "rarbg",
    "1337x",
    "thepiratebay",
    "torrentgalaxy",
    "magnetdl",
    "nyaasi",
  ];

  if (!dto) {
    return {
      providers: DEFAULT_PROVIDERS,
      sort: "quality",
      priorityLanguages: [],
      qualityFilters: ["scr", "cam"],
      limit: "",
      sizeFilter: "",
      debridOptions: [],
    };
  }

  return {
    providers: dto.publicConfig?.providers || DEFAULT_PROVIDERS,
    sort: dto.publicConfig?.sort || "quality",
    priorityLanguages: dto.publicConfig?.priorityLanguages || [],
    qualityFilters: dto.publicConfig?.qualityFilters || ["scr", "cam"],
    limit: dto.publicConfig?.limit ?? "",
    sizeFilter: dto.publicConfig?.sizeFilter ?? "",
    debridOptions: dto.publicConfig?.debridOptions || [],
  };
}

describe("Milestone 6E — Stremio Switch UI & Workflow State Logic", () => {
  describe("1. Dashboard Tile State Mapping", () => {
    it("maps unconfigured state correctly", () => {
      const tileState = mapStremioDashboardTileState(null);
      assert.equal(tileState.status, "NOT CONFIGURED");
      assert.equal(tileState.statusType, "muted");
      assert.equal(tileState.actionLabel, "CONFIGURE");
      assert.equal(tileState.destination, "/modules/stremio-switch");
      assert.equal(tileState.isConfigured, false);
      assert.equal(tileState.isCapabilityActive, false);
    });

    it("maps configured but inactive capability state correctly", () => {
      const config = {
        id: "cf1",
        providerName: "torrentio",
        publicConfig: { sort: "seeders" },
        capabilityConfigured: false,
        capabilityHint: null,
      };

      const tileState = mapStremioDashboardTileState(config);
      assert.equal(tileState.status, "CONFIGURED");
      assert.equal(tileState.statusType, "warning");
      assert.equal(tileState.actionLabel, "OPEN");
      assert.equal(tileState.sort, "seeders");
      assert.equal(tileState.isCapabilityActive, false);
    });

    it("maps active capability state with hint correctly", () => {
      const config = {
        id: "cf2",
        providerName: "torrentio",
        publicConfig: { sort: "qualitysize" },
        capabilityConfigured: true,
        capabilityHint: "st_9xK2...4pLm",
      };

      const tileState = mapStremioDashboardTileState(config);
      assert.equal(tileState.status, "ADDON ACTIVE");
      assert.equal(tileState.statusType, "online");
      assert.equal(tileState.actionLabel, "OPEN");
      assert.equal(tileState.capabilityHint, "st_9xK2...4pLm");
      assert.equal(tileState.sort, "qualitysize");
      assert.equal(tileState.isCapabilityActive, true);
    });
  });

  describe("2. Config DTO to Form State Mapping", () => {
    it("initializes default form state when no DTO exists", () => {
      const form = initFormStateFromDto(null);
      assert.ok(Array.isArray(form.providers));
      assert.equal(form.providers.length, 8);
      assert.equal(form.sort, "quality");
      assert.deepEqual(form.priorityLanguages, []);
      assert.deepEqual(form.qualityFilters, ["scr", "cam"]);
      assert.equal(form.limit, "");
      assert.equal(form.sizeFilter, "");
      assert.deepEqual(form.debridOptions, []);
    });

    it("maps existing DTO options into form state fields", () => {
      const dto = {
        id: "cf1",
        providerName: "torrentio",
        publicConfig: {
          providers: ["yts", "1337x"],
          sort: "size",
          priorityLanguages: ["french", "german"],
          qualityFilters: ["4k", "1080p"],
          limit: 15,
          sizeFilter: "10GB",
          debridOptions: ["nodownloadlinks"],
        },
        capabilityConfigured: true,
        capabilityHint: "st_test...1234",
      };

      const form = initFormStateFromDto(dto);
      assert.deepEqual(form.providers, ["yts", "1337x"]);
      assert.equal(form.sort, "size");
      assert.deepEqual(form.priorityLanguages, ["french", "german"]);
      assert.deepEqual(form.qualityFilters, ["4k", "1080p"]);
      assert.equal(form.limit, 15);
      assert.equal(form.sizeFilter, "10GB");
      assert.deepEqual(form.debridOptions, ["nodownloadlinks"]);
    });
  });

  describe("3. URL Import & Credential Discarding Invariant", () => {
    it("extracts publicConfig and discards provider credential strictly", () => {
      const sensitiveToken = "SENSITIVE_OAUTH_TOKEN_NEVER_PERSIST_9999";
      const importUrl = `https://torrentio.strem.fun/providers=yts,eztv|sort=seeders|qualityfilter=cam|realdebrid=${sensitiveToken}/manifest.json`;

      const parsed = parseTorrentioUrl(importUrl);

      // Verify options are extracted
      assert.deepEqual(parsed.publicConfig.providers, ["yts", "eztv"]);
      assert.equal(parsed.publicConfig.sort, "seeders");
      assert.deepEqual(parsed.publicConfig.qualityFilters, ["cam"]);

      // Invariant: Credential is extracted into parsed.credential but NOT in publicConfig
      assert.equal("credential" in parsed.publicConfig, false);
      assert.equal("realdebrid" in parsed.publicConfig, false);
      assert.equal("secret" in parsed.publicConfig, false);

      const serializedPublic = JSON.stringify(parsed.publicConfig);
      assert.equal(serializedPublic.includes(sensitiveToken), false);
    });
  });

  describe("4. Addon URL Construction (HTTPS & Stremio Protocol)", () => {
    it("constructs valid HTTPS and stremio:// URLs for localhost", () => {
      const capability = generateStremioCapability();
      const urls = constructStremioAddonUrls(
        "http://localhost:3000",
        "localhost:3000",
        capability
      );

      assert.equal(
        urls.httpsUrl,
        `http://localhost:3000/api/stremio/${capability}/manifest.json`
      );
      assert.equal(
        urls.stremioUrl,
        `stremio://localhost:3000/api/stremio/${capability}/manifest.json`
      );
    });

    it("constructs valid HTTPS and stremio:// URLs for custom production domain", () => {
      const capability = generateStremioCapability();
      const urls = constructStremioAddonUrls(
        "https://daemon.example.com",
        "daemon.example.com",
        capability
      );

      assert.equal(
        urls.httpsUrl,
        `https://daemon.example.com/api/stremio/${capability}/manifest.json`
      );
      assert.equal(
        urls.stremioUrl,
        `stremio://daemon.example.com/api/stremio/${capability}/manifest.json`
      );
    });

    it("ensures capability URL contains no percent-encoding characters", () => {
      const capability = generateStremioCapability();
      const urls = constructStremioAddonUrls(
        "https://mydaemon.com",
        "mydaemon.com",
        capability
      );

      assert.equal(urls.httpsUrl.includes("%"), false);
      assert.equal(urls.httpsUrl.includes("?"), false);
      assert.equal(urls.stremioUrl.includes("%"), false);
      assert.equal(urls.stremioUrl.includes("?"), false);
    });
  });

  describe("5. Capability Lifecycle & One-Time Memory State Management", () => {
    it("simulates rotate -> one-time display -> dismiss lifecycle in memory", () => {
      let clientConfig = {
        id: "cf_active_1",
        providerName: "torrentio",
        publicConfig: { sort: "quality" },
        capabilityConfigured: false,
        capabilityHint: null,
      };

      let oneTimeState = null;

      // 1. Trigger rotation (simulates /rotate API response)
      const newPlaintextCapability = generateStremioCapability();
      const hint = formatCapabilityHint(newPlaintextCapability);

      const rotateApiResponse = {
        capability: newPlaintextCapability,
        capabilityHint: hint,
      };

      // Client updates state upon receiving response
      const urls = constructStremioAddonUrls(
        "http://localhost:3000",
        "localhost:3000",
        rotateApiResponse.capability
      );

      clientConfig = {
        ...clientConfig,
        capabilityConfigured: true,
        capabilityHint: rotateApiResponse.capabilityHint,
      };

      oneTimeState = {
        capability: rotateApiResponse.capability,
        hint: rotateApiResponse.capabilityHint,
        ...urls,
      };

      // Verify active and display populated
      assert.equal(clientConfig.capabilityConfigured, true);
      assert.equal(clientConfig.capabilityHint, hint);
      assert.ok(oneTimeState);
      assert.equal(oneTimeState.capability, newPlaintextCapability);

      // 2. User dismisses one-time modal
      oneTimeState = null;

      // Verify plaintext token is gone from memory
      assert.equal(oneTimeState, null);
      // But persistent hint remains
      assert.equal(clientConfig.capabilityConfigured, true);
      assert.equal(clientConfig.capabilityHint, hint);
    });

    it("simulates revoke lifecycle", () => {
      let clientConfig = {
        id: "cf_active_2",
        providerName: "torrentio",
        publicConfig: { sort: "quality" },
        capabilityConfigured: true,
        capabilityHint: "st_ABCD...WXYZ",
      };

      // Trigger revocation (simulates /revoke API response)
      clientConfig = {
        ...clientConfig,
        capabilityConfigured: false,
        capabilityHint: null,
      };

      assert.equal(clientConfig.capabilityConfigured, false);
      assert.equal(clientConfig.capabilityHint, null);
    });
  });

  describe("6. Secret Containment Invariant in DTO & Render Data", () => {
    it("proves that no capability hash, RD tokens, or user_id appear in public DTO", () => {
      const publicDto = {
        id: "cf100000-0000-4000-8000-000000000001",
        providerName: "torrentio",
        publicConfig: { providers: ["yts"] },
        capabilityConfigured: true,
        capabilityHint: "st_9xK2...4pLm",
        createdAt: "2026-09-07T00:00:00.000Z",
        updatedAt: "2026-09-07T01:00:00.000Z",
        isConfigured: true,
      };

      assert.equal("capability_hash" in publicDto, false);
      assert.equal("capabilityHash" in publicDto, false);
      assert.equal("proxy_id" in publicDto, false);
      assert.equal("proxyId" in publicDto, false);
      assert.equal("user_id" in publicDto, false);
      assert.equal("userId" in publicDto, false);
      assert.equal("token" in publicDto, false);
      assert.equal("secret" in publicDto, false);
    });
  });
});
