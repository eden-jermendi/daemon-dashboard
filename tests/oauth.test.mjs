import test from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function buildAuthUrl(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return `https://api.real-debrid.com/oauth/v2/auth?${params.toString()}`;
}

function buildRefreshBody(clientId, clientSecret, storedRefreshToken) {
  return new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: storedRefreshToken,
    grant_type: "http://oauth.net/grant_type/device/1.0",
  });
}

test("Real-Debrid OAuth Protocol Rules", async (t) => {
  await t.test("constant-time state comparison correctly validates matches and mismatches", () => {
    const validState = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
    assert.equal(safeCompare(validState, validState), true);
    assert.equal(safeCompare(validState, "wrong_state_value"), false);
    assert.equal(safeCompare(validState, validState.slice(0, 10)), false);
    assert.equal(safeCompare("", validState), false);
  });

  await t.test("builds official Real-Debrid 3-legged authorization URL with expected parameters", () => {
    const clientId = "RD_CLIENT_ID_123";
    const redirectUri = "http://localhost:3000/api/integrations/real-debrid/callback";
    const state = "csrf_random_state_hex_string";

    const url = buildAuthUrl(clientId, redirectUri, state);
    const parsed = new URL(url);

    assert.equal(parsed.origin, "https://api.real-debrid.com");
    assert.equal(parsed.pathname, "/oauth/v2/auth");
    assert.equal(parsed.searchParams.get("client_id"), clientId);
    assert.equal(parsed.searchParams.get("redirect_uri"), redirectUri);
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.equal(parsed.searchParams.get("state"), state);
  });

  await t.test("refresh body strictly adheres to documented Real-Debrid device grant semantics", () => {
    const clientId = "RD_CLIENT_ID_123";
    const clientSecret = "RD_SECRET_456";
    const refreshToken = "stored_refresh_token_789";

    const body = buildRefreshBody(clientId, clientSecret, refreshToken);

    assert.equal(body.get("client_id"), clientId);
    assert.equal(body.get("client_secret"), clientSecret);
    // Real-Debrid specific: stored refresh token is passed in 'code' param!
    assert.equal(body.get("code"), refreshToken);
    // Real-Debrid specific: grant_type is the device grant URI
    assert.equal(body.get("grant_type"), "http://oauth.net/grant_type/device/1.0");
    assert.equal(body.get("grant_type") !== "refresh_token", true);
  });
});
