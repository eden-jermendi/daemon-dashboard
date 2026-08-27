import test from "node:test";
import assert from "node:assert/strict";

const REAL_DEBRID_OPEN_SOURCE_CLIENT_ID = "X245A4XAIBGVM";

function buildDeviceCodeUrl() {
  const url = new URL("https://api.real-debrid.com/oauth/v2/device/code");
  url.searchParams.set("client_id", REAL_DEBRID_OPEN_SOURCE_CLIENT_ID);
  url.searchParams.set("new_credentials", "yes");
  return url.toString();
}

function buildDeviceCredentialsUrl(deviceCode) {
  const url = new URL("https://api.real-debrid.com/oauth/v2/device/credentials");
  url.searchParams.set("client_id", REAL_DEBRID_OPEN_SOURCE_CLIENT_ID);
  url.searchParams.set("code", deviceCode.trim());
  return url.toString();
}

function buildTokenExchangeBody(clientId, clientSecret, deviceCode) {
  return new URLSearchParams({
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    code: deviceCode.trim(),
    grant_type: "http://oauth.net/grant_type/device/1.0",
  });
}

function buildRefreshBody(clientId, clientSecret, storedRefreshToken) {
  return new URLSearchParams({
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    code: storedRefreshToken.trim(),
    grant_type: "http://oauth.net/grant_type/device/1.0",
  });
}

function normalizeCredentialStatus(statusCode, data) {
  if (statusCode === 200 && data && data.client_id && data.client_secret) {
    return { status: "authorized", credentials: data };
  }
  if (statusCode === 404 || statusCode === 410) {
    return { status: "expired" };
  }
  return { status: "pending" };
}

test("Real-Debrid Open-Source Device OAuth Protocol Rules", async (t) => {
  await t.test("device code URL uses published open-source client ID and new_credentials=yes", () => {
    const url = buildDeviceCodeUrl();
    const parsed = new URL(url);

    assert.equal(parsed.origin, "https://api.real-debrid.com");
    assert.equal(parsed.pathname, "/oauth/v2/device/code");
    assert.equal(parsed.searchParams.get("client_id"), "X245A4XAIBGVM");
    assert.equal(parsed.searchParams.get("new_credentials"), "yes");
  });

  await t.test("device credentials check URL constructs expected query parameters", () => {
    const deviceCode = "RD_DEVICE_CODE_12345";
    const url = buildDeviceCredentialsUrl(deviceCode);
    const parsed = new URL(url);

    assert.equal(parsed.origin, "https://api.real-debrid.com");
    assert.equal(parsed.pathname, "/oauth/v2/device/credentials");
    assert.equal(parsed.searchParams.get("client_id"), "X245A4XAIBGVM");
    assert.equal(parsed.searchParams.get("code"), deviceCode);
  });

  await t.test("credential status normalizes pending, authorized, and expired states", () => {
    // 1. Pending (HTTP 400 or 403 awaiting authorization)
    const pendingResult = normalizeCredentialStatus(400, { error: "authorization_pending" });
    assert.equal(pendingResult.status, "pending");

    // 2. Authorized (HTTP 200 with generated client_id and client_secret)
    const authorizedResult = normalizeCredentialStatus(200, {
      client_id: "GEN_CLIENT_123",
      client_secret: "GEN_SECRET_456",
    });
    assert.equal(authorizedResult.status, "authorized");
    assert.equal(authorizedResult.credentials.client_id, "GEN_CLIENT_123");
    assert.equal(authorizedResult.credentials.client_secret, "GEN_SECRET_456");

    // 3. Expired (HTTP 404 or 410)
    const expiredResult = normalizeCredentialStatus(404, { error: "code_expired" });
    assert.equal(expiredResult.status, "expired");
  });

  await t.test("token exchange uses user-bound generated credentials and device grant", () => {
    const clientId = "USER_BOUND_CLIENT_ID";
    const clientSecret = "USER_BOUND_CLIENT_SECRET";
    const deviceCode = "USER_DEVICE_CODE";

    const body = buildTokenExchangeBody(clientId, clientSecret, deviceCode);

    assert.equal(body.get("client_id"), clientId);
    assert.equal(body.get("client_secret"), clientSecret);
    assert.equal(body.get("code"), deviceCode);
    assert.equal(body.get("grant_type"), "http://oauth.net/grant_type/device/1.0");
  });

  await t.test("token refresh uses stored user-bound credentials and stored refresh token", () => {
    const clientId = "STORED_USER_CLIENT_ID";
    const clientSecret = "STORED_USER_CLIENT_SECRET";
    const refreshToken = "STORED_REFRESH_TOKEN";

    const body = buildRefreshBody(clientId, clientSecret, refreshToken);

    assert.equal(body.get("client_id"), clientId);
    assert.equal(body.get("client_secret"), clientSecret);
    assert.equal(body.get("code"), refreshToken);
    assert.equal(body.get("grant_type"), "http://oauth.net/grant_type/device/1.0");
  });
});
