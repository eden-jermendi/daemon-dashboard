import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseTorrentioUrl,
  serializeTorrentioConfig,
  serializeTorrentioConfigWithCredential,
  serializeTorrentioPublicConfig,
  toRedactedTorrentioConfig,
  TorrentioConfigError,
} from "../src/features/stremio-switch/domain/torrentio/index.ts";

const SYNTHETIC_SECRET = "FAKEREALDEBRIDAPITOKEN998877665544";
const SYNTHETIC_SECRET_WITH_SPECIALS = "FAKE_RD-TOKEN_998877665544--XX";

describe("Torrentio Configuration Parser & Serializer", () => {
  describe("Valid configurations", () => {
    it("parses a minimal Real-Debrid configuration URL", () => {
      const input = `https://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}/manifest.json`;
      const config = parseTorrentioUrl(input);

      assert.equal(config.provider, "torrentio");
      assert.deepEqual(config.publicConfig, {});
      assert.equal(config.credential.kind, "realdebrid");
      assert.equal(config.credential.secret, SYNTHETIC_SECRET);
    });

    it("parses a token with hyphens and underscores", () => {
      const input = `https://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET_WITH_SPECIALS}/manifest.json`;
      const config = parseTorrentioUrl(input);

      assert.equal(config.credential.secret, SYNTHETIC_SECRET_WITH_SPECIALS);
    });

    it("parses a complete configuration URL with all supported options", () => {
      const input =
        `https://torrentio.strem.fun/` +
        `providers=yts,1337x,eztv|` +
        `sort=qualitysize|` +
        `language=spanish,french|` +
        `qualityfilter=480p,cam,scr|` +
        `limit=50|` +
        `sizefilter=10GB,2GB|` +
        `debridoptions=nodownloadlinks,nocatalog|` +
        `realdebrid=${SYNTHETIC_SECRET}/manifest.json`;

      const config = parseTorrentioUrl(input);

      assert.equal(config.provider, "torrentio");
      assert.deepEqual(config.publicConfig.providers, ["yts", "1337x", "eztv"]);
      assert.equal(config.publicConfig.sort, "qualitysize");
      assert.deepEqual(config.publicConfig.priorityLanguages, ["spanish", "french"]);
      assert.deepEqual(config.publicConfig.qualityFilters, ["480p", "cam", "scr"]);
      assert.equal(config.publicConfig.limit, 50);
      assert.equal(config.publicConfig.sizeFilter, "10GB,2GB");
      assert.deepEqual(config.publicConfig.debridOptions, ["nodownloadlinks", "nocatalog"]);
      assert.equal(config.credential.secret, SYNTHETIC_SECRET);
    });

    it("deduplicates list values for providers, languages, and qualities", () => {
      const input = `https://torrentio.strem.fun/providers=yts,yts,1337x|language=spanish,spanish|qualityfilter=480p,480p|realdebrid=${SYNTHETIC_SECRET}/manifest.json`;
      const config = parseTorrentioUrl(input);

      assert.deepEqual(config.publicConfig.providers, ["yts", "1337x"]);
      assert.deepEqual(config.publicConfig.priorityLanguages, ["spanish"]);
      assert.deepEqual(config.publicConfig.qualityFilters, ["480p"]);
    });

    it("round-trips parsing and serialization canonically", () => {
      const input =
        `https://torrentio.strem.fun/` +
        `providers=yts,1337x|` +
        `sort=seeders|` +
        `language=japanese|` +
        `qualityfilter=brremux,480p|` +
        `limit=10|` +
        `sizefilter=5GB|` +
        `debridoptions=nocatalog|` +
        `realdebrid=${SYNTHETIC_SECRET}/manifest.json`;

      const parsed1 = parseTorrentioUrl(input);
      const serializedConfig = serializeTorrentioConfig(parsed1);
      const reconstructedUrl = `https://torrentio.strem.fun/${serializedConfig}/manifest.json`;
      const parsed2 = parseTorrentioUrl(reconstructedUrl);

      assert.deepEqual(parsed1, parsed2);
    });

    it("normalizes default sort=quality canonically", () => {
      const input = `https://torrentio.strem.fun/sort=quality|realdebrid=${SYNTHETIC_SECRET}/manifest.json`;
      const parsed1 = parseTorrentioUrl(input);
      assert.equal(parsed1.publicConfig.sort, undefined);

      const serializedConfig = serializeTorrentioConfig(parsed1);
      assert.equal(serializedConfig, `realdebrid=${SYNTHETIC_SECRET}`);
      const reconstructedUrl = `https://torrentio.strem.fun/${serializedConfig}/manifest.json`;
      const parsed2 = parseTorrentioUrl(reconstructedUrl);

      assert.deepEqual(parsed1, parsed2);
    });
  });

  describe("Invalid authority and origin", () => {
    it("rejects HTTP scheme", () => {
      assert.throws(
        () => parseTorrentioUrl(`http://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}/manifest.json`),
        (err) => err instanceof TorrentioConfigError && err.code === "UNSUPPORTED_SCHEME"
      );
    });

    it("rejects stremio scheme at configuration input boundary", () => {
      assert.throws(
        () => parseTorrentioUrl(`stremio://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}/manifest.json`),
        (err) => err instanceof TorrentioConfigError && err.code === "UNSUPPORTED_SCHEME"
      );
    });

    it("rejects incorrect hostname", () => {
      assert.throws(
        () => parseTorrentioUrl(`https://attacker.com/realdebrid=${SYNTHETIC_SECRET}/manifest.json`),
        (err) => err instanceof TorrentioConfigError && err.code === "UNSUPPORTED_HOST"
      );
    });

    it("rejects prefix/suffix domain spoofing attempts", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun.attacker.com/realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "UNSUPPORTED_HOST"
      );

      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://evil-torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "UNSUPPORTED_HOST"
      );
    });

    it("rejects custom port numbers", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun:8080/realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "UNSUPPORTED_PORT"
      );
    });

    it("rejects username or password in authority", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://user:pass@torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_USERINFO"
      );
    });
  });

  describe("Invalid URL structure and path shapes", () => {
    it("rejects URL with query parameters", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}/manifest.json?extra=param`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_QUERY_OR_FRAGMENT"
      );
    });

    it("rejects URL with hash fragments", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}/manifest.json#fragment`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_QUERY_OR_FRAGMENT"
      );
    });

    it("rejects URL missing manifest.json endpoint", () => {
      assert.throws(
        () => parseTorrentioUrl(`https://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}`),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_PATH"
      );
    });

    it("rejects URL with extra path segments", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/extra/realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_PATH"
      );

      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}/manifest.json/extra`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_PATH"
      );
    });

    it("rejects URL with trailing slashes or duplicate slashes", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}/manifest.json/`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_PATH"
      );

      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun//realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_PATH"
      );
    });

    it("rejects URL containing encoded path separators or traversal sequences", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}%2Fextra/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_URL"
      );
    });

    it("rejects excessively long URLs", () => {
      const longString = "a".repeat(3000);
      assert.throws(
        () => parseTorrentioUrl(`https://torrentio.strem.fun/${longString}/manifest.json`),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_URL"
      );
    });

    it("rejects URLs containing control characters or null bytes", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}\x00/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_URL"
      );
    });
  });

  describe("Invalid configuration syntax and delimiters", () => {
    it("rejects empty segments and double pipes", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/||realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_SYNTAX"
      );

      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/sort=seeders||realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_SYNTAX"
      );
    });

    it("rejects items without equals sign", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/no_equals_here|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_SYNTAX"
      );
    });

    it("rejects items with multiple equals signs", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/sort=seeders=extra|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_SYNTAX"
      );
    });

    it("rejects empty keys or empty values", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/=value|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_SYNTAX"
      );

      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/sort=|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_SYNTAX"
      );
    });

    it("rejects duplicate configuration keys", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/sort=seeders|sort=size|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "DUPLICATE_OPTION"
      );
    });

    it("rejects unknown configuration keys", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/unsupported_key=123|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "UNKNOWN_OPTION"
      );
    });
  });

  describe("Option value validation", () => {
    it("rejects unsupported provider identifiers", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/providers=yts,fake_provider|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
      );
    });

    it("rejects unsupported sort options", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/sort=random_sort|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
      );
    });

    it("rejects unsupported language identifiers", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/language=klingon|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
      );
    });

    it("rejects unsupported quality filters", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/qualityfilter=16k|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
      );
    });

    it("rejects invalid limit values (non-numeric, zero, negative, out of range)", () => {
      for (const invalidLimit of ["0", "-5", "abc", "1000"]) {
        assert.throws(
          () =>
            parseTorrentioUrl(
              `https://torrentio.strem.fun/limit=${invalidLimit}|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
            ),
          (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
        );
      }
    });

    it("rejects malformed size filter formats", () => {
      for (const invalidSize of ["huge", "200", "10GB,2GB,1GB", "10PB"]) {
        assert.throws(
          () =>
            parseTorrentioUrl(
              `https://torrentio.strem.fun/sizefilter=${invalidSize}|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
            ),
          (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
        );
      }
    });

    it("rejects unsupported debrid options", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/debridoptions=autoplay|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
      );
    });
  });

  describe("Real-Debrid credential handling & invariants", () => {
    it("rejects configuration missing any debrid provider", () => {
      assert.throws(
        () => parseTorrentioUrl("https://torrentio.strem.fun/sort=seeders/manifest.json"),
        (err) => err instanceof TorrentioConfigError && err.code === "MISSING_CREDENTIAL"
      );
    });

    it("rejects other/unsupported debrid providers in this contract", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/alldebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "UNSUPPORTED_CREDENTIAL"
      );

      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/premiumize=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "UNSUPPORTED_CREDENTIAL"
      );
    });

    it("rejects multiple debrid providers", () => {
      assert.throws(
        () =>
          parseTorrentioUrl(
            `https://torrentio.strem.fun/alldebrid=OTHERTOKEN12345678|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "MULTIPLE_CREDENTIALS"
      );
    });

    it("rejects malformed Real-Debrid API tokens", () => {
      // Too short (<16)
      assert.throws(
        () => parseTorrentioUrl("https://torrentio.strem.fun/realdebrid=short/manifest.json"),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_CREDENTIAL"
      );

      // Contains special characters / delimiters
      assert.throws(
        () =>
          parseTorrentioUrl(
            "https://torrentio.strem.fun/realdebrid=TOKEN_WITH_PIPE|INJECTION/manifest.json"
          ),
        (err) =>
          err instanceof TorrentioConfigError &&
          (err.code === "INVALID_CREDENTIAL" || err.code === "INVALID_SYNTAX")
      );

      // Contains spaces
      assert.throws(
        () =>
          parseTorrentioUrl(
            "https://torrentio.strem.fun/realdebrid=TOKEN WITH SPACES 123456/manifest.json"
          ),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_CREDENTIAL"
      );
    });
  });

  describe("Secret containment and redaction", () => {
    it("guarantees the synthetic secret never appears in redacted representation", () => {
      const config = parseTorrentioUrl(
        `https://torrentio.strem.fun/providers=yts|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
      );
      const redacted = toRedactedTorrentioConfig(config);

      const serializedRedacted = JSON.stringify(redacted);
      assert.equal(serializedRedacted.includes(SYNTHETIC_SECRET), false);
      assert.equal(redacted.credential.isConfigured, true);
      assert.equal(redacted.credential.secret, undefined);
    });

    it("guarantees the synthetic secret never appears in public configuration serialization", () => {
      const config = parseTorrentioUrl(
        `https://torrentio.strem.fun/providers=yts,1337x|sort=seeders|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
      );
      const publicString = serializeTorrentioPublicConfig(config);

      assert.equal(publicString.includes(SYNTHETIC_SECRET), false);
      assert.equal(publicString, "providers=yts,1337x|sort=seeders");
    });

    it("guarantees error messages never contain or echo the secret", () => {
      try {
        parseTorrentioUrl(
          `https://torrentio.strem.fun/unknown_opt=123|realdebrid=${SYNTHETIC_SECRET}/manifest.json`
        );
        assert.fail("Expected error");
      } catch (err) {
        assert.equal(err instanceof TorrentioConfigError, true);
        assert.equal(err.message.includes(SYNTHETIC_SECRET), false);
      }

      try {
        parseTorrentioUrl(
          `https://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET}!invalid/manifest.json`
        );
        assert.fail("Expected error");
      } catch (err) {
        assert.equal(err instanceof TorrentioConfigError, true);
        assert.equal(err.message.includes(SYNTHETIC_SECRET), false);
      }
    });
  });

  describe("Defensive serialization against manual invalid inputs", () => {
    it("rejects serialization of manually constructed config with invalid/injected secret", () => {
      const malformedConfig = {
        provider: "torrentio",
        publicConfig: {},
        credential: {
          kind: "realdebrid",
          secret: "injected|secret=evil",
        },
      };

      assert.throws(
        () => serializeTorrentioConfig(malformedConfig),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_CREDENTIAL"
      );
    });

    it("rejects serialization of manually constructed config with injected option value", () => {
      const malformedConfig = {
        provider: "torrentio",
        publicConfig: {
          sort: "seeders|injected=evil",
        },
        credential: {
          kind: "realdebrid",
          secret: SYNTHETIC_SECRET,
        },
      };

      assert.throws(
        () => serializeTorrentioConfig(malformedConfig),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_OPTION_VALUE"
      );
    });
  });

  describe("Runtime Credential Injection Serialization", () => {
    it("serializes public config with RealDebridCredential object canonically", () => {
      const publicConfig = {
        providers: ["yts", "1337x"],
        sort: "seeders",
      };
      const credential = {
        kind: "realdebrid",
        secret: SYNTHETIC_SECRET,
      };

      const serialized = serializeTorrentioConfigWithCredential(publicConfig, credential);
      assert.equal(serialized, `providers=yts,1337x|sort=seeders|realdebrid=${SYNTHETIC_SECRET}`);
    });

    it("serializes public config with raw token string canonically", () => {
      const publicConfig = {
        providers: ["yts"],
        limit: 20,
      };

      const serialized = serializeTorrentioConfigWithCredential(publicConfig, SYNTHETIC_SECRET);
      assert.equal(serialized, `providers=yts|limit=20|realdebrid=${SYNTHETIC_SECRET}`);
    });

    it("serializes empty public config with token string", () => {
      const serialized = serializeTorrentioConfigWithCredential({}, SYNTHETIC_SECRET);
      assert.equal(serialized, `realdebrid=${SYNTHETIC_SECRET}`);
    });

    it("rejects invalid or malformed runtime credentials", () => {
      assert.throws(
        () => serializeTorrentioConfigWithCredential({}, "too_short"),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_CREDENTIAL"
      );

      assert.throws(
        () => serializeTorrentioConfigWithCredential({}, "injected|token=value"),
        (err) => err instanceof TorrentioConfigError && err.code === "INVALID_CREDENTIAL"
      );
    });
  });
});
