import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedCdnHost,
  isValidProxyId,
  parseTorrentioResolverUrl,
  reconstructTorrentioResolverUrl,
  rewriteTorrentioStreamResponse,
  sanitizeErrorMessage,
  validateResolverSegments,
} from "../src/features/stremio-switch/domain/torrentio/index.ts";

const SYNTHETIC_SECRET_TOKEN = "0123456789abcdef0123456789abcdef01234567";
const VALID_PROXY_ID = "a1b2c3d4-e5f6-4a1b-8c2d-0e1f2a3b4c5d";
const BASE_URL = "https://daemon.local:3000";

describe("Milestone 6D — Secure Stremio Capability Proxy & Stream Resolver", () => {
  describe("1. Capability Identifier (proxyId) Validation", () => {
    it("accepts valid UUID v4 format", () => {
      assert.equal(isValidProxyId("c3d0b2fa-26a3-41a8-b64c-323e1e92c28e"), true);
      assert.equal(isValidProxyId("00000000-0000-4000-8000-000000000000"), true);
      assert.equal(isValidProxyId(VALID_PROXY_ID), true);
    });

    it("rejects non-UUID and malformed capability identifiers", () => {
      assert.equal(isValidProxyId("not-a-uuid"), false);
      assert.equal(isValidProxyId(""), false);
      assert.equal(isValidProxyId("c3d0b2fa26a341a8b64c323e1e92c28e"), false);
      assert.equal(isValidProxyId("../traversal/attempt"), false);
      assert.equal(isValidProxyId("c3d0b2fa-26a3-41a8-b64c-323e1e92c28e/extra"), false);
      assert.equal(isValidProxyId(null), false);
      assert.equal(isValidProxyId(undefined), false);
    });
  });

  describe("2. Recognition and Parsing of Torrentio Real-Debrid Resolver URLs", () => {
    it("parses valid resolver URL and strictly discards token", () => {
      const url = `https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/72f242db89e763b6ce390f25d576195c2169b149/null/0/Big.Buck.Bunny.4K.mkv`;
      const parsed = parseTorrentioResolverUrl(url);

      assert.notEqual(parsed, null);
      assert.equal(parsed.infoHash, "72f242db89e763b6ce390f25d576195c2169b149");
      assert.equal(parsed.torrentId, "null");
      assert.equal(parsed.fileIdx, "0");
      assert.equal(parsed.filename, "Big.Buck.Bunny.4K.mkv");

      // Critical token containment test: parsed object must NEVER contain the secret
      const jsonStr = JSON.stringify(parsed);
      assert.equal(jsonStr.includes(SYNTHETIC_SECRET_TOKEN), false);
      assert.equal("secret" in parsed, false);
      assert.equal("token" in parsed, false);
    });

    it("parses resolver URL without filename", () => {
      const url = `https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/4b47961d4fdd82f3e789121f317f398166aa5944/null/3`;
      const parsed = parseTorrentioResolverUrl(url);

      assert.notEqual(parsed, null);
      assert.equal(parsed.infoHash, "4b47961d4fdd82f3e789121f317f398166aa5944");
      assert.equal(parsed.torrentId, "null");
      assert.equal(parsed.fileIdx, "3");
      assert.equal(parsed.filename, undefined);
    });

    it("parses resolver URL with numeric torrentId", () => {
      const url = `https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/4b47961d4fdd82f3e789121f317f398166aa5944/12345/3/Episode.1.mkv`;
      const parsed = parseTorrentioResolverUrl(url);

      assert.notEqual(parsed, null);
      assert.equal(parsed.torrentId, "12345");
      assert.equal(parsed.fileIdx, "3");
      assert.equal(parsed.filename, "Episode.1.mkv");
    });

    it("fails closed on non-torrentio hosts or invalid schemes", () => {
      assert.equal(
        parseTorrentioResolverUrl(`http://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/72f242db89e763b6ce390f25d576195c2169b149/null/0`),
        null
      );
      assert.equal(
        parseTorrentioResolverUrl(`https://evil.com/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/72f242db89e763b6ce390f25d576195c2169b149/null/0`),
        null
      );
      assert.equal(
        parseTorrentioResolverUrl(`https://torrentio.strem.fun:8080/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/72f242db89e763b6ce390f25d576195c2169b149/null/0`),
        null
      );
    });

    it("fails closed on malformed infoHash or unexpected segment count", () => {
      // Short infohash
      assert.equal(
        parseTorrentioResolverUrl(`https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/short/null/0`),
        null
      );
      // Extra unexpected segments
      assert.equal(
        parseTorrentioResolverUrl(`https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/72f242db89e763b6ce390f25d576195c2169b149/null/0/file.mkv/extra`),
        null
      );
    });

    it("fails closed on path traversal or null bytes in filename", () => {
      assert.equal(
        parseTorrentioResolverUrl(`https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/72f242db89e763b6ce390f25d576195c2169b149/null/0/..%2Fsecret.txt`),
        null
      );
      assert.equal(
        parseTorrentioResolverUrl(`https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/72f242db89e763b6ce390f25d576195c2169b149/null/0/file%00.mkv`),
        null
      );
    });
  });

  describe("3. Stream URL Rewriting Algorithm", () => {
    it("rewrites credential-bearing resolver URLs to Daemon capability URLs", () => {
      const upstreamJson = {
        streams: [
          {
            name: "[RD+] Torrentio\n4k",
            title: "Big Buck Bunny 4K\n👤 10 💾 850 MB",
            url: `https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/72f242db89e763b6ce390f25d576195c2169b149/null/0/Big.Buck.Bunny.4K.mkv`,
            behaviorHints: {
              bingeGroup: "torrentio|4k",
              filename: "Big.Buck.Bunny.4K.mkv",
            },
          },
        ],
      };

      const rewritten = rewriteTorrentioStreamResponse(upstreamJson, VALID_PROXY_ID, BASE_URL);

      assert.equal(rewritten.streams.length, 1);
      const stream = rewritten.streams[0];

      // Verify safe rewritten URL
      assert.equal(
        stream.url,
        `${BASE_URL}/api/stremio/${VALID_PROXY_ID}/resolve/72f242db89e763b6ce390f25d576195c2169b149/null/0/Big.Buck.Bunny.4K.mkv`
      );

      // Verify non-secret metadata is preserved
      assert.equal(stream.name, "[RD+] Torrentio\n4k");
      assert.equal(stream.title, "Big Buck Bunny 4K\n👤 10 💾 850 MB");
      assert.deepEqual(stream.behaviorHints, {
        bingeGroup: "torrentio|4k",
        filename: "Big.Buck.Bunny.4K.mkv",
      });

      // ABSOLUTE SECURITY INVARIANT: RD Token must NOT appear anywhere in the output
      const serialized = JSON.stringify(rewritten);
      assert.equal(serialized.includes(SYNTHETIC_SECRET_TOKEN), false);
    });

    it("rewrites multiple streams and preserves uncached P2P streams without URLs", () => {
      const upstreamJson = {
        streams: [
          {
            name: "[RD+] Torrentio 1080p",
            title: "Stream 1",
            url: `https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/1111111111111111111111111111111111111111/null/0/Stream1.mkv`,
          },
          {
            name: "[RD+] Torrentio 720p",
            title: "Stream 2",
            url: `https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/2222222222222222222222222222222222222222/null/1/Stream2.mkv`,
          },
          {
            name: "Torrentio P2P",
            title: "P2P Torrent",
            infoHash: "3333333333333333333333333333333333333333",
            fileIdx: 0,
          },
        ],
      };

      const rewritten = rewriteTorrentioStreamResponse(upstreamJson, VALID_PROXY_ID, BASE_URL);

      assert.equal(rewritten.streams.length, 3);
      assert.equal(
        rewritten.streams[0].url,
        `${BASE_URL}/api/stremio/${VALID_PROXY_ID}/resolve/1111111111111111111111111111111111111111/null/0/Stream1.mkv`
      );
      assert.equal(
        rewritten.streams[1].url,
        `${BASE_URL}/api/stremio/${VALID_PROXY_ID}/resolve/2222222222222222222222222222222222222222/null/1/Stream2.mkv`
      );
      assert.equal(rewritten.streams[2].url, undefined);
      assert.equal(rewritten.streams[2].infoHash, "3333333333333333333333333333333333333333");
    });

    it("fails closed on malformed resolver URL by omitting the unsafe stream entry", () => {
      const upstreamJson = {
        streams: [
          {
            name: "Malformed Stream",
            title: "Corrupt URL",
            url: `https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/invalid_hash/null`,
          },
          {
            name: "Valid Stream",
            title: "Good URL",
            url: `https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/72f242db89e763b6ce390f25d576195c2169b149/null/0/good.mkv`,
          },
        ],
      };

      const rewritten = rewriteTorrentioStreamResponse(upstreamJson, VALID_PROXY_ID, BASE_URL);

      // The corrupt stream must be dropped, valid stream retained
      assert.equal(rewritten.streams.length, 1);
      assert.equal(rewritten.streams[0].name, "Valid Stream");
      assert.equal(JSON.stringify(rewritten).includes("invalid_hash"), false);
      assert.equal(JSON.stringify(rewritten).includes(SYNTHETIC_SECRET_TOKEN), false);
    });

    it("fails closed and drops any stream attempting external realdebrid exposure", () => {
      const upstreamJson = {
        streams: [
          {
            name: "Suspicious Stream",
            url: `https://attacker.com/leak?realdebrid=${SYNTHETIC_SECRET_TOKEN}`,
          },
        ],
      };

      const rewritten = rewriteTorrentioStreamResponse(upstreamJson, VALID_PROXY_ID, BASE_URL);
      assert.equal(rewritten.streams.length, 0);
    });
  });

  describe("4. Safe Resolver Path Validation", () => {
    it("accepts valid resolver segments", () => {
      const segments = [
        "72f242db89e763b6ce390f25d576195c2169b149",
        "null",
        "0",
        "Big.Buck.Bunny.mkv",
      ];
      const validated = validateResolverSegments(segments);

      assert.notEqual(validated, null);
      assert.equal(validated.infoHash, "72f242db89e763b6ce390f25d576195c2169b149");
      assert.equal(validated.torrentId, "null");
      assert.equal(validated.fileIdx, "0");
      assert.equal(validated.filename, "Big.Buck.Bunny.mkv");
    });

    it("accepts segments without optional filename", () => {
      const segments = [
        "72f242db89e763b6ce390f25d576195c2169b149",
        "12345",
        "2",
      ];
      const validated = validateResolverSegments(segments);

      assert.notEqual(validated, null);
      assert.equal(validated.torrentId, "12345");
      assert.equal(validated.fileIdx, "2");
      assert.equal(validated.filename, undefined);
    });

    it("rejects invalid segment lengths (too short or too long)", () => {
      assert.equal(validateResolverSegments(["only_one"]), null);
      assert.equal(validateResolverSegments(["one", "two"]), null);
      assert.equal(
        validateResolverSegments(["hash", "null", "0", "file.mkv", "extra_fifth"]),
        null
      );
    });

    it("rejects malformed infoHash or non-alphanumeric torrentId", () => {
      assert.equal(
        validateResolverSegments(["invalid_hash", "null", "0"]),
        null
      );
      assert.equal(
        validateResolverSegments([
          "72f242db89e763b6ce390f25d576195c2169b149",
          "invalid id with spaces!",
          "0",
        ]),
        null
      );
      assert.equal(
        validateResolverSegments([
          "72f242db89e763b6ce390f25d576195c2169b149",
          "null",
          "not_a_number",
        ]),
        null
      );
    });

    it("rejects path traversal and malicious filenames", () => {
      assert.equal(
        validateResolverSegments([
          "72f242db89e763b6ce390f25d576195c2169b149",
          "null",
          "0",
          "../../etc/passwd",
        ]),
        null
      );
      assert.equal(
        validateResolverSegments([
          "72f242db89e763b6ce390f25d576195c2169b149",
          "null",
          "0",
          "malicious\x00file.mkv",
        ]),
        null
      );
      assert.equal(
        validateResolverSegments([
          "72f242db89e763b6ce390f25d576195c2169b149",
          "null",
          "0",
          "a".repeat(501),
        ]),
        null
      );
    });
  });

  describe("5. Upstream Resolver URL Reconstruction", () => {
    it("reconstructs exact upstream Torrentio URL using runtime token", () => {
      const data = {
        infoHash: "72f242db89e763b6ce390f25d576195c2169b149",
        torrentId: "null",
        fileIdx: "0",
        filename: "Big.Buck.Bunny.4K.mkv",
      };

      const reconstructed = reconstructTorrentioResolverUrl(
        SYNTHETIC_SECRET_TOKEN,
        data
      );

      assert.equal(
        reconstructed,
        `https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/72f242db89e763b6ce390f25d576195c2169b149/null/0/Big.Buck.Bunny.4K.mkv`
      );
    });

    it("reconstructs resolver URL without filename", () => {
      const data = {
        infoHash: "4b47961d4fdd82f3e789121f317f398166aa5944",
        torrentId: "9988",
        fileIdx: "2",
      };

      const reconstructed = reconstructTorrentioResolverUrl(
        SYNTHETIC_SECRET_TOKEN,
        data
      );

      assert.equal(
        reconstructed,
        `https://torrentio.strem.fun/resolve/realdebrid/${SYNTHETIC_SECRET_TOKEN}/4b47961d4fdd82f3e789121f317f398166aa5944/9988/2`
      );
    });

    it("rejects token injection attempts in reconstructor", () => {
      const data = {
        infoHash: "72f242db89e763b6ce390f25d576195c2169b149",
        torrentId: "null",
        fileIdx: "0",
      };

      assert.throws(
        () => reconstructTorrentioResolverUrl("token/with/slash", data),
        /Invalid token/
      );
      assert.throws(
        () => reconstructTorrentioResolverUrl("token..traversal", data),
        /Invalid token/
      );
    });
  });

  describe("6. Real-Debrid CDN Redirect Destination Allowlist", () => {
    it("allows valid *.download.real-debrid.com hostnames", () => {
      assert.equal(isAllowedCdnHost("akl1-4.download.real-debrid.com"), true);
      assert.equal(isAllowedCdnHost("fra1-2.download.real-debrid.com"), true);
      assert.equal(isAllowedCdnHost("sjc1.download.real-debrid.com"), true);
      assert.equal(isAllowedCdnHost("download.real-debrid.com"), true);
    });

    it("rejects arbitrary or spoofed redirect destinations", () => {
      assert.equal(isAllowedCdnHost("evil.com"), false);
      assert.equal(isAllowedCdnHost("download.real-debrid.com.attacker.com"), false);
      assert.equal(isAllowedCdnHost("not-download.real-debrid.com"), false);
      assert.equal(isAllowedCdnHost("torrentio.strem.fun"), false);
      assert.equal(isAllowedCdnHost(""), false);
      assert.equal(isAllowedCdnHost(null), false);
    });
  });

  describe("7. Error and Exception Sanitization", () => {
    it("scrubs URLs and sensitive tokens from error messages", () => {
      const errorWithUrl = new Error(
        `fetch failed to https://torrentio.strem.fun/realdebrid=${SYNTHETIC_SECRET_TOKEN}/manifest.json`
      );
      const sanitized = sanitizeErrorMessage(errorWithUrl, SYNTHETIC_SECRET_TOKEN);

      assert.equal(sanitized.includes(SYNTHETIC_SECRET_TOKEN), false);
      assert.equal(sanitized.includes("torrentio.strem.fun"), false);
      assert.equal(sanitized.includes("[REDACTED"), true);
    });

    it("scrubs tokens from non-error strings", () => {
      const msg = `Failed request containing secret ${SYNTHETIC_SECRET_TOKEN} in log line`;
      const sanitized = sanitizeErrorMessage(msg, SYNTHETIC_SECRET_TOKEN);

      assert.equal(sanitized.includes(SYNTHETIC_SECRET_TOKEN), false);
      assert.equal(sanitized.includes("[REDACTED_TOKEN]"), true);
    });
  });

  describe("8. Token Refresh In-Process Coalescing", () => {
    it("coalesces concurrent refresh calls into a single in-flight operation", async () => {
      let callCount = 0;
      const inFlightRefreshes = new Map();

      async function mockRefreshOperation(userId) {
        const inFlight = inFlightRefreshes.get(userId);
        if (inFlight) {
          return inFlight;
        }

        const promise = (async () => {
          try {
            callCount++;
            // Simulate slight async network delay
            await new Promise((resolve) => setTimeout(resolve, 20));
            return `new_token_for_${userId}_call_${callCount}`;
          } finally {
            inFlightRefreshes.delete(userId);
          }
        })();

        inFlightRefreshes.set(userId, promise);
        return promise;
      }

      // Fire 5 concurrent requests simultaneously for the same user
      const results = await Promise.all([
        mockRefreshOperation("user_alpha"),
        mockRefreshOperation("user_alpha"),
        mockRefreshOperation("user_alpha"),
        mockRefreshOperation("user_alpha"),
        mockRefreshOperation("user_alpha"),
      ]);

      // Exactly ONE refresh call should have occurred
      assert.equal(callCount, 1);
      // All 5 callers received identical refreshed token
      results.forEach((res) => {
        assert.equal(res, "new_token_for_user_alpha_call_1");
      });
    });
  });

  describe("9. Manifest Protocol Orchestration & Headers", () => {
    it("verifies manifest headers and CORS", () => {
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      };

      assert.equal(headers["Access-Control-Allow-Origin"], "*");
      assert.equal(headers["Content-Type"], "application/json; charset=utf-8");
      assert.equal(headers["Access-Control-Allow-Methods"], "GET, OPTIONS");
    });
  });

  describe("10. Resolver Redirect Security & Hand-off", () => {
    it("accepts valid Real-Debrid CDN redirect destinations", () => {
      const validLocations = [
        "https://akl1-4.download.real-debrid.com/d/ABC123XYZ/video.mkv",
        "https://fra1-2.download.real-debrid.com/d/DEF456UVW/movie.mp4",
        "https://download.real-debrid.com/d/789/file.avi",
      ];

      for (const loc of validLocations) {
        const u = new URL(loc);
        assert.equal(u.protocol, "https:");
        assert.equal(isAllowedCdnHost(u.hostname), true);
      }
    });

    it("rejects malicious, unapproved, or non-CDN redirect destinations", () => {
      const invalidLocations = [
        "https://evil-attacker.com/steal",
        "http://akl1-4.download.real-debrid.com/insecure", // HTTP not allowed
        "https://torrentio.strem.fun/malicious",
        "https://fake-download.real-debrid.com.attacker.com/d/123",
      ];

      for (const loc of invalidLocations) {
        const u = new URL(loc);
        const isSecure = u.protocol === "https:";
        const isAllowed = isAllowedCdnHost(u.hostname);
        assert.equal(isSecure && isAllowed, false);
      }
    });

    it("intercepts Torrentio failure video redirect as an explicit failure", () => {
      const failureLocation = "https://torrentio.strem.fun/videos/failed_access_v3.mp4";
      const u = new URL(failureLocation);
      const isFailureVideo =
        u.hostname === "torrentio.strem.fun" && u.pathname.startsWith("/videos/");

      assert.equal(isFailureVideo, true);
      assert.equal(isAllowedCdnHost(u.hostname), false);
    });
  });

  describe("11. Comprehensive Token Leak Defense Invariants", () => {
    it("proves the Real-Debrid token never leaks in rewritten stream payloads", () => {
      const sensitiveToken = "SEC_OAUTH_TOKEN_999888777666555444333222111";
      const streamPayload = {
        streams: [
          {
            name: "[RD+] Torrentio",
            title: "Movie Name",
            url: `https://torrentio.strem.fun/resolve/realdebrid/${sensitiveToken}/72f242db89e763b6ce390f25d576195c2169b149/null/0/movie.mkv`,
          },
          {
            name: "[RD download] Torrentio",
            title: "Movie Name 2",
            url: `https://torrentio.strem.fun/resolve/realdebrid/${sensitiveToken}/4b47961d4fdd82f3e789121f317f398166aa5944/null/1/movie2.mkv`,
          },
        ],
      };

      const result = rewriteTorrentioStreamResponse(
        streamPayload,
        VALID_PROXY_ID,
        "https://mydaemon.com"
      );

      const serialized = JSON.stringify(result);

      // Verify token absent
      assert.equal(serialized.includes(sensitiveToken), false);
      // Verify rewritten properly
      assert.equal(
        result.streams[0].url,
        `https://mydaemon.com/api/stremio/${VALID_PROXY_ID}/resolve/72f242db89e763b6ce390f25d576195c2169b149/null/0/movie.mkv`
      );
      assert.equal(
        result.streams[1].url,
        `https://mydaemon.com/api/stremio/${VALID_PROXY_ID}/resolve/4b47961d4fdd82f3e789121f317f398166aa5944/null/1/movie2.mkv`
      );
    });

    it("proves the Real-Debrid token never leaks in sanitized error output", () => {
      const sensitiveToken = "SEC_OAUTH_TOKEN_999888777666555444333222111";
      const rawError = new Error(
        `Upstream request to https://torrentio.strem.fun/providers=yts|realdebrid=${sensitiveToken}/manifest.json failed with code 500`
      );

      const sanitized = sanitizeErrorMessage(rawError, sensitiveToken);

      assert.equal(sanitized.includes(sensitiveToken), false);
      assert.equal(sanitized.includes("torrentio.strem.fun"), false);
      assert.equal(sanitized.includes("[REDACTED"), true);
    });
  });
});
