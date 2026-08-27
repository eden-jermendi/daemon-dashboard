import test from "node:test";
import assert from "node:assert/strict";

const SHORT_MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

function normalizeRealDebridUserResponse(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid Real-Debrid user response: expected object.");
  }

  const record = data;

  const username = typeof record.username === "string" && record.username.trim()
    ? record.username.trim()
    : "Unknown User";

  const isPremium = record.type === "premium";
  const accountType = isPremium ? "premium" : "free";

  const premiumRemainingSeconds = typeof record.premium === "number" && !isNaN(record.premium)
    ? Math.max(0, Math.floor(record.premium))
    : 0;

  let expiration = null;
  if (typeof record.expiration === "string" && record.expiration.trim()) {
    const parsedDate = new Date(record.expiration);
    if (!isNaN(parsedDate.getTime())) {
      expiration = parsedDate;
    }
  }

  const fidelityPoints = typeof record.points === "number" && !isNaN(record.points)
    ? Math.max(0, Math.floor(record.points))
    : 0;

  return {
    username,
    accountType,
    isPremium,
    premiumRemainingSeconds,
    expiration,
    fidelityPoints,
  };
}

function formatPremiumRemaining(seconds) {
  if (seconds <= 0) {
    return "Expired";
  }

  const SECONDS_PER_DAY = 86400;
  const SECONDS_PER_HOUR = 3600;
  const SECONDS_PER_MINUTE = 60;

  if (seconds >= SECONDS_PER_DAY) {
    const days = Math.floor(seconds / SECONDS_PER_DAY);
    return days === 1 ? "1 day" : `${days} days`;
  }

  if (seconds >= SECONDS_PER_HOUR) {
    const hours = Math.floor(seconds / SECONDS_PER_HOUR);
    const mins = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  const mins = Math.max(1, Math.floor(seconds / SECONDS_PER_MINUTE));
  return `${mins}m`;
}

function formatExpirationDate(date, style = "full") {
  if (!date || isNaN(date.getTime())) {
    return "N/A";
  }

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  if (style === "short") {
    const shortMonth = SHORT_MONTHS[date.getMonth()] || month;
    return `${day} ${shortMonth} ${year}`;
  }

  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  const secs = date.getSeconds().toString().padStart(2, "0");

  return `${day}-${month}-${year} ${hours}:${mins}:${secs}`;
}

test("Real-Debrid Account Status & Normalization", async (t) => {
  await t.test("normalizes a valid Premium account response and omits private fields", () => {
    const rawApiUser = {
      id: 999999,
      username: "debrid_master",
      email: "user@example.com",
      points: 1250,
      locale: "en",
      avatar: "https://real-debrid.com/images/forum/empty.png",
      type: "premium",
      premium: 15638400, // 181 days
      expiration: "2027-02-25T14:30:00.000Z",
    };

    const account = normalizeRealDebridUserResponse(rawApiUser);

    assert.equal(account.username, "debrid_master");
    assert.equal(account.accountType, "premium");
    assert.equal(account.isPremium, true);
    assert.equal(account.premiumRemainingSeconds, 15638400);
    assert.equal(account.fidelityPoints, 1250);
    assert.ok(account.expiration instanceof Date);
    assert.equal(account.expiration.toISOString(), "2027-02-25T14:30:00.000Z");

    // Verify private / internal fields are omitted from application model
    assert.equal("email" in account, false);
    assert.equal("id" in account, false);
    assert.equal("avatar" in account, false);
    assert.equal("locale" in account, false);
  });

  await t.test("normalizes a free / non-premium account response", () => {
    const rawApiUser = {
      id: 12345,
      username: "free_user",
      type: "free",
      points: 50,
      premium: 0,
      expiration: "",
    };

    const account = normalizeRealDebridUserResponse(rawApiUser);

    assert.equal(account.username, "free_user");
    assert.equal(account.accountType, "free");
    assert.equal(account.isPremium, false);
    assert.equal(account.premiumRemainingSeconds, 0);
    assert.equal(account.expiration, null);
    assert.equal(account.fidelityPoints, 50);
  });

  await t.test("defensively handles missing or malformed fields", () => {
    const malformed = {
      points: "not-a-number",
      premium: -100,
      expiration: "invalid-date-string",
    };

    const account = normalizeRealDebridUserResponse(malformed);

    assert.equal(account.username, "Unknown User");
    assert.equal(account.accountType, "free");
    assert.equal(account.isPremium, false);
    assert.equal(account.premiumRemainingSeconds, 0);
    assert.equal(account.expiration, null);
    assert.equal(account.fidelityPoints, 0);
  });

  await t.test("formatPremiumRemaining converts seconds to human-readable durations", () => {
    assert.equal(formatPremiumRemaining(0), "Expired");
    assert.equal(formatPremiumRemaining(-50), "Expired");
    assert.equal(formatPremiumRemaining(86400 * 181), "181 days");
    assert.equal(formatPremiumRemaining(86400), "1 day");
    assert.equal(formatPremiumRemaining(3600 * 5), "5h");
    assert.equal(formatPremiumRemaining(3600 * 5 + 60 * 30), "5h 30m");
    assert.equal(formatPremiumRemaining(60 * 45), "45m");
    assert.equal(formatPremiumRemaining(30), "1m");
  });

  await t.test("formatExpirationDate formats dates with project DD-MM-YYYY standard", () => {
    const testDate = new Date("2027-02-25T14:30:00Z");
    
    // Short style (used on Dashboard tile)
    const shortFormatted = formatExpirationDate(testDate, "short");
    assert.match(shortFormatted, /^\d{2} FEB 2027$/);

    // Full style (used on Module page: DD-MM-YYYY HH:mm:ss)
    const fullFormatted = formatExpirationDate(testDate, "full");
    assert.match(fullFormatted, /^\d{2}-\d{2}-2027 \d{2}:\d{2}:\d{2}$/);

    assert.equal(formatExpirationDate(null), "N/A");
  });
});
