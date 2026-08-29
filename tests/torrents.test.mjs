import test from "node:test";
import assert from "node:assert/strict";

// Pure validation logic mirroring validateMagnetUri
function validateMagnetUri(rawMagnet) {
  if (!rawMagnet || typeof rawMagnet !== "string" || !rawMagnet.trim()) {
    return { valid: false, error: "Magnet URI is required." };
  }

  const trimmed = rawMagnet.trim();

  if (!trimmed.toLowerCase().startsWith("magnet:?")) {
    return {
      valid: false,
      error: "Invalid magnet URI format. Must begin with 'magnet:?'.",
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: "Malformed magnet URI syntax.",
    };
  }

  if (parsed.protocol !== "magnet:") {
    return {
      valid: false,
      error: `Unsupported protocol (${parsed.protocol}). Only 'magnet:' URIs are supported.`,
    };
  }

  const xtParams = parsed.searchParams.getAll("xt");
  if (!xtParams || xtParams.length === 0) {
    return {
      valid: false,
      error: "Magnet URI missing required 'xt' (exact topic) parameter.",
    };
  }

  const hasBtih = xtParams.some((xt) => {
    const lower = xt.toLowerCase();
    return (
      /^urn:btih:[a-f0-9]{40}$/i.test(lower) ||
      /^urn:btih:[a-z2-7]{32}$/i.test(lower) ||
      /^urn:btmh:[a-f0-9]+$/i.test(lower) ||
      /^urn:btih:[a-z0-9]+$/i.test(lower)
    );
  });

  if (!hasBtih) {
    return {
      valid: false,
      error: "Magnet URI does not contain a valid BitTorrent info hash (urn:btih or urn:btmh).",
    };
  }

  return { valid: true, normalizedMagnet: trimmed };
}

// Pure validation logic mirroring validateTorrentId
function validateTorrentId(id) {
  if (!id || typeof id !== "string" || !id.trim()) {
    return { valid: false, error: "Torrent ID is required." };
  }

  const trimmed = id.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: "Invalid torrent ID format." };
  }

  return { valid: true, normalizedId: trimmed };
}

// Pure status mapping mirroring normalizeTorrentStatus
function normalizeTorrentStatus(rawStatus) {
  const raw = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "unknown";

  switch (raw) {
    case "magnet_conversion":
      return { status: "magnet_conversion", rawStatus: raw };
    case "waiting_files_selection":
      return { status: "waiting_files_selection", rawStatus: raw };
    case "queued":
      return { status: "queued", rawStatus: raw };
    case "downloading":
      return { status: "downloading", rawStatus: raw };
    case "downloaded":
      return { status: "downloaded", rawStatus: raw };
    case "compressing":
    case "uploading":
      return { status: "processing", rawStatus: raw };
    case "virus":
      return { status: "virus", rawStatus: raw };
    case "dead":
      return { status: "dead", rawStatus: raw };
    case "magnet_error":
    case "error":
      return { status: "error", rawStatus: raw };
    default:
      return { status: "error", rawStatus: raw };
  }
}

// Pure torrent info normalizer mirroring normalizeTorrentInfo
function normalizeTorrentInfo(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid Real-Debrid torrent info response: expected JSON object.");
  }

  const record = data;

  if (typeof record.error === "string" && record.error.trim()) {
    const errorCode = typeof record.error_code === "number" ? record.error_code : null;
    let message = record.error;
    if (errorCode === 20) message = "This operation requires an active Real-Debrid Premium account.";
    else if (errorCode === 16) message = "Unsupported torrent or hoster.";
    throw new Error(message);
  }

  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : "";
  if (!id) {
    throw new Error("Torrent info response is missing a valid ID.");
  }

  const filename = typeof record.filename === "string" && record.filename.trim()
    ? record.filename.trim()
    : "Unnamed Torrent";

  const originalFilename = typeof record.original_filename === "string" && record.original_filename.trim()
    ? record.original_filename.trim()
    : filename;

  const hash = typeof record.hash === "string" && record.hash.trim()
    ? record.hash.trim()
    : "";

  const bytes = typeof record.bytes === "number" && !isNaN(record.bytes) && record.bytes >= 0
    ? Math.floor(record.bytes)
    : 0;

  const originalBytes = typeof record.original_bytes === "number" && !isNaN(record.original_bytes) && record.original_bytes >= 0
    ? Math.floor(record.original_bytes)
    : bytes;

  const host = typeof record.host === "string" && record.host.trim()
    ? record.host.trim()
    : "real-debrid.com";

  const rawProgress = typeof record.progress === "number" && !isNaN(record.progress)
    ? record.progress
    : 0;
  const progress = Math.max(0, Math.min(100, Math.floor(rawProgress)));

  const { status, rawStatus } = normalizeTorrentStatus(record.status);

  const addedDate = typeof record.added === "string" && record.added.trim()
    ? record.added.trim()
    : null;

  const endedDate = typeof record.ended === "string" && record.ended.trim()
    ? record.ended.trim()
    : null;

  const speed = typeof record.speed === "number" && !isNaN(record.speed) && record.speed >= 0
    ? Math.floor(record.speed)
    : null;

  const seeders = typeof record.seeders === "number" && !isNaN(record.seeders) && record.seeders >= 0
    ? Math.floor(record.seeders)
    : null;

  const files = [];
  if (Array.isArray(record.files)) {
    for (const f of record.files) {
      if (f && typeof f === "object") {
        const fileId = typeof f.id === "number" ? f.id : parseInt(String(f.id), 10);
        if (!isNaN(fileId)) {
          files.push({
            id: fileId,
            path: typeof f.path === "string" ? f.path : `/file_${fileId}`,
            bytes: typeof f.bytes === "number" && f.bytes >= 0 ? Math.floor(f.bytes) : 0,
            selected: f.selected === 1 || f.selected === true,
          });
        }
      }
    }
  }

  const links = [];
  if (Array.isArray(record.links)) {
    for (const l of record.links) {
      if (typeof l === "string" && l.trim()) {
        links.push(l.trim());
      }
    }
  }

  return {
    id,
    filename,
    originalFilename,
    hash,
    bytes,
    originalBytes,
    host,
    progress,
    status,
    rawStatus,
    addedDate,
    endedDate,
    speed,
    seeders,
    files,
    links,
  };
}

// File Selection ID Formatter
function formatFileSelection(fileIds) {
  if (fileIds === "all") {
    return "all";
  }
  if (Array.isArray(fileIds)) {
    const valid = fileIds
      .map((fid) => (typeof fid === "number" ? fid : parseInt(String(fid), 10)))
      .filter((fid) => !isNaN(fid) && fid >= 0);
    if (valid.length === 0) {
      throw new Error("Please select at least one file to download.");
    }
    return valid.join(",");
  }
  throw new Error("Invalid file selection parameter.");
}

test("Real-Debrid Torrent & Magnet Workflow", async (t) => {
  await t.test("Magnet Validation: accepts valid BTIH hex, base32, and multihash URIs", () => {
    // 40-character hex SHA1
    const hexMagnet =
      "magnet:?xt=urn:btih:6b39d1b066fe505d9284fa9a0f443b71ccfe874d&dn=Ubuntu+22.04&tr=https%3A%2F%2Ftracker.com";
    const res1 = validateMagnetUri(hexMagnet);
    assert.equal(res1.valid, true);
    assert.equal(res1.normalizedMagnet, hexMagnet);

    // 32-character base32 SHA1
    const b32Magnet =
      "magnet:?xt=urn:btih:NNE5DMDG3ZIF3ERK7KNQ6RB3OHGP5B2N&dn=Sample.Archive";
    const res2 = validateMagnetUri(b32Magnet);
    assert.equal(res2.valid, true);

    // Multihash btmh
    const btmhMagnet =
      "magnet:?xt=urn:btmh:12206b39d1b066fe505d9284fa9a0f443b71ccfe874d&dn=Hybrid";
    const res3 = validateMagnetUri(btmhMagnet);
    assert.equal(res3.valid, true);
  });

  await t.test("Magnet Validation: rejects malformed, non-magnet, or missing xt inputs", () => {
    assert.equal(validateMagnetUri("").valid, false);
    assert.equal(validateMagnetUri("   ").valid, false);
    assert.equal(validateMagnetUri("https://example.com/torrent.torrent").valid, false);
    assert.equal(validateMagnetUri("magnet:?dn=TestWithoutXt").valid, false);
    assert.equal(validateMagnetUri("magnet:?xt=urn:ed2k:354b15e68fb8f36d7db88048").valid, false);
  });

  await t.test("Torrent ID Validation: enforces safe alphanumeric identifier format", () => {
    assert.equal(validateTorrentId("ABC123XYZ").valid, true);
    assert.equal(validateTorrentId("torrent_id-99").valid, true);
    assert.equal(validateTorrentId("../traversal").valid, false);
    assert.equal(validateTorrentId("id/with/slash").valid, false);
    assert.equal(validateTorrentId("id with spaces").valid, false);
    assert.equal(validateTorrentId("").valid, false);
  });

  await t.test("Status Normalization: correctly maps all documented provider statuses", () => {
    assert.equal(normalizeTorrentStatus("magnet_conversion").status, "magnet_conversion");
    assert.equal(normalizeTorrentStatus("waiting_files_selection").status, "waiting_files_selection");
    assert.equal(normalizeTorrentStatus("queued").status, "queued");
    assert.equal(normalizeTorrentStatus("downloading").status, "downloading");
    assert.equal(normalizeTorrentStatus("downloaded").status, "downloaded");
    assert.equal(normalizeTorrentStatus("compressing").status, "processing");
    assert.equal(normalizeTorrentStatus("uploading").status, "processing");
    assert.equal(normalizeTorrentStatus("virus").status, "virus");
    assert.equal(normalizeTorrentStatus("dead").status, "dead");
    assert.equal(normalizeTorrentStatus("magnet_error").status, "error");
    assert.equal(normalizeTorrentStatus("error").status, "error");
    assert.equal(normalizeTorrentStatus("unknown_future_status").status, "error");
  });

  await t.test("Torrent Info Normalization: normalizes full active downloading payload", () => {
    const rawPayload = {
      id: "TORRENT123",
      filename: "Debian.12.ISO",
      original_filename: "Debian.12.ISO.Original",
      hash: "6b39d1b066fe505d9284fa9a0f443b71ccfe874d",
      bytes: 1073741824, // 1 GB selected
      original_bytes: 2147483648, // 2 GB total
      host: "real-debrid.com",
      split: 2000,
      progress: 68.4,
      status: "downloading",
      added: "2026-08-29T10:00:00.000Z",
      speed: 15728640, // ~15 MB/s
      seeders: 42,
      files: [
        { id: 1, path: "/Debian.12.iso", bytes: 1073741824, selected: 1 },
        { id: 2, path: "/Debian.12.checksum.txt", bytes: 1024, selected: 0 },
      ],
      links: [],
    };

    const normalized = normalizeTorrentInfo(rawPayload);
    assert.equal(normalized.id, "TORRENT123");
    assert.equal(normalized.filename, "Debian.12.ISO");
    assert.equal(normalized.originalFilename, "Debian.12.ISO.Original");
    assert.equal(normalized.hash, "6b39d1b066fe505d9284fa9a0f443b71ccfe874d");
    assert.equal(normalized.bytes, 1073741824);
    assert.equal(normalized.originalBytes, 2147483648);
    assert.equal(normalized.progress, 68);
    assert.equal(normalized.status, "downloading");
    assert.equal(normalized.speed, 15728640);
    assert.equal(normalized.seeders, 42);
    assert.equal(normalized.files.length, 2);
    assert.equal(normalized.files[0].selected, true);
    assert.equal(normalized.files[1].selected, false);
    assert.equal(normalized.links.length, 0);
  });

  await t.test("Torrent Info Normalization: normalizes downloaded state with generated links", () => {
    const rawPayload = {
      id: "TORRENT456",
      filename: "Arch.Linux.2026",
      hash: "abc123hash",
      bytes: 850000000,
      progress: 100,
      status: "downloaded",
      ended: "2026-08-29T10:05:00.000Z",
      files: [{ id: 1, path: "/arch.iso", bytes: 850000000, selected: 1 }],
      links: [
        "https://real-debrid.com/d/LINK12345",
        "https://real-debrid.com/d/LINK67890",
      ],
    };

    const normalized = normalizeTorrentInfo(rawPayload);
    assert.equal(normalized.status, "downloaded");
    assert.equal(normalized.progress, 100);
    assert.equal(normalized.endedDate, "2026-08-29T10:05:00.000Z");
    assert.equal(normalized.links.length, 2);
    assert.equal(normalized.links[0], "https://real-debrid.com/d/LINK12345");
    assert.equal(normalized.speed, null);
    assert.equal(normalized.seeders, null);
  });

  await t.test("File Selection Serialization: correctly formats IDs and handles 'all'", () => {
    assert.equal(formatFileSelection([1, 2, 3]), "1,2,3");
    assert.equal(formatFileSelection(["1", "5", "9"]), "1,5,9");
    assert.equal(formatFileSelection("all"), "all");
    assert.throws(() => formatFileSelection([]), /at least one file/i);
  });

  await t.test("Error Handling: surfaces provider error messages and non-premium codes", () => {
    assert.throws(
      () => normalizeTorrentInfo({ error: "permission_denied", error_code: 20 }),
      /Real-Debrid Premium/i
    );
    assert.throws(
      () => normalizeTorrentInfo({ error: "bad_torrent" }),
      /bad_torrent/
    );
    assert.throws(
      () => normalizeTorrentInfo(null),
      /expected JSON object/i
    );
  });
});
