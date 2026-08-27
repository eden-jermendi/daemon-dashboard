import test from "node:test";
import assert from "node:assert/strict";

// Pure validation logic mirroring validateLinkUrl
function validateLinkUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { valid: false, error: "Link URL is required." };
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format. Please enter a valid HTTP or HTTPS URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `Unsupported protocol (${parsed.protocol}). Only HTTP and HTTPS URLs are supported.`,
    };
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}

// Pure byte formatter mirroring formatBytes
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
    return "UNKNOWN";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  if (unitIndex === 0) {
    return `${Math.round(size)} B`;
  }

  const precision = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  const numStr = size.toFixed(precision);
  const cleanNum = parseFloat(numStr).toString();

  return `${cleanNum} ${units[unitIndex]}`;
}

// Check normalization mirroring normalizeCheckResponse
function normalizeCheckResponse(data, httpStatus, originalLink) {
  let fallbackHost = null;
  try {
    const parsed = new URL(originalLink);
    fallbackHost = parsed.hostname;
  } catch {
    fallbackHost = null;
  }

  if (httpStatus === 503) {
    return {
      status: "file_unavailable",
      host: fallbackHost,
      link: originalLink,
      filename: null,
      filesize: null,
      supported: false,
      message: "The provider reports that this file is currently unavailable.",
    };
  }

  if (data && typeof data === "object" && !Array.isArray(data) && "error" in data) {
    const record = data;
    const errorCode = typeof record.error_code === "number" ? record.error_code : null;
    const host = typeof record.host === "string" && record.host.trim()
      ? record.host.trim()
      : fallbackHost;

    if (errorCode === 16 || record.error === "unsupported_hoster" || record.error === "hoster_unsupported") {
      return {
        status: "unsupported",
        host,
        link: originalLink,
        filename: null,
        filesize: null,
        supported: false,
        message: "Real-Debrid does not report this hoster or link as supported.",
      };
    }

    if (errorCode === 24 || record.error === "file_unavailable") {
      return {
        status: "file_unavailable",
        host,
        link: originalLink,
        filename: null,
        filesize: null,
        supported: false,
        message: "The provider reports that this file is currently unavailable.",
      };
    }

    let message = typeof record.error === "string" ? record.error : "Provider returned an error.";
    if (errorCode === 13) {
      message = "Invalid host password provided.";
    } else if (errorCode === 17 || errorCode === 19) {
      message = "Hoster is temporarily unavailable or in maintenance.";
    } else if (errorCode === 20) {
      message = "This hoster requires an active Real-Debrid Premium account.";
    }

    return {
      status: "error",
      host,
      link: originalLink,
      filename: null,
      filesize: null,
      supported: false,
      message,
    };
  }

  if ((data === null || data === undefined || data === "") && httpStatus === 200) {
    return {
      status: "unsupported",
      host: fallbackHost,
      link: originalLink,
      filename: null,
      filesize: null,
      supported: false,
      message: "Real-Debrid does not report this link as supported.",
    };
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data;
    const supportedNum = typeof record.supported === "number" ? record.supported : 0;
    const isSupported = supportedNum === 1;

    const host = typeof record.host === "string" && record.host.trim()
      ? record.host.trim()
      : fallbackHost;

    const filename = typeof record.filename === "string" && record.filename.trim()
      ? record.filename.trim()
      : null;

    const rawFilesize = typeof record.filesize === "number" && !isNaN(record.filesize) && record.filesize > 0
      ? Math.floor(record.filesize)
      : null;

    return {
      status: isSupported ? "supported" : "unsupported",
      host,
      link: typeof record.link === "string" && record.link.trim() ? record.link.trim() : originalLink,
      filename,
      filesize: rawFilesize,
      supported: isSupported,
      message: isSupported
        ? undefined
        : "Real-Debrid does not report this link as supported.",
    };
  }

  return {
    status: "error",
    host: fallbackHost,
    link: originalLink,
    filename: null,
    filesize: null,
    supported: false,
    message: httpStatus !== 200
      ? `Provider returned HTTP status ${httpStatus}.`
      : "Provider returned an unrecognized response.",
  };
}

// Unrestrict normalization mirroring normalizeUnrestrictResponse
function parseSingleDownloadItem(record) {
  const downloadUrl = typeof record.download === "string" && record.download.trim()
    ? record.download.trim()
    : "";

  if (!downloadUrl) {
    return null;
  }

  const id = typeof record.id === "string" && record.id.trim()
    ? record.id.trim()
    : `dl-${Date.now()}`;

  const filename = typeof record.filename === "string" && record.filename.trim()
    ? record.filename.trim()
    : "unrestricted_file";

  const rawFilesize = typeof record.filesize === "number" && !isNaN(record.filesize) && record.filesize > 0
    ? Math.floor(record.filesize)
    : null;

  const mimeType = typeof record.mimeType === "string" && record.mimeType.trim()
    ? record.mimeType.trim()
    : null;

  const host = typeof record.host === "string" && record.host.trim()
    ? record.host.trim()
    : "unknown";

  const streamable = record.streamable === 1 || record.streamable === true;

  const type = typeof record.type === "string" && record.type.trim()
    ? record.type.trim()
    : null;

  return {
    id,
    filename,
    filesize: rawFilesize,
    mimeType,
    host,
    downloadUrl,
    streamable,
    type,
  };
}

function normalizeUnrestrictResponse(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid Real-Debrid unrestrict response: expected object or array.");
  }

  const downloads = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === "object") {
        const parsed = parseSingleDownloadItem(item);
        if (parsed) {
          downloads.push(parsed);
        }
      }
    }
  } else {
    const record = data;

    if (typeof record.error === "string" && record.error.trim()) {
      const errorCode = typeof record.error_code === "number" ? record.error_code : null;
      let message = record.error;
      if (errorCode === 13) message = "Invalid host password provided.";
      else if (errorCode === 16) message = "Unsupported hoster.";
      else if (errorCode === 20) message = "This hoster requires an active Real-Debrid Premium account.";
      else if (errorCode === 24 || record.error === "file_unavailable") message = "The source file is unavailable.";
      else if (errorCode === 23) message = "Real-Debrid traffic limit for this host has been exhausted.";
      throw new Error(message);
    }

    const primary = parseSingleDownloadItem(record);
    if (primary) {
      downloads.push(primary);
    }

    if (Array.isArray(record.alternative)) {
      for (let i = 0; i < record.alternative.length; i++) {
        const alt = record.alternative[i];
        if (alt && typeof alt === "object") {
          const downloadUrl = typeof alt.download === "string" ? alt.download.trim() : "";
          if (downloadUrl) {
            downloads.push({
              id: typeof alt.id === "string" && alt.id.trim()
                ? alt.id.trim()
                : `${primary?.id || "alt"}-${i + 1}`,
              filename: typeof alt.filename === "string" && alt.filename.trim()
                ? alt.filename.trim()
                : primary?.filename || "unrestricted_file",
              filesize: typeof alt.filesize === "number" && alt.filesize > 0
                ? Math.floor(alt.filesize)
                : primary?.filesize ?? null,
              mimeType: typeof alt.mimeType === "string" && alt.mimeType.trim()
                ? alt.mimeType.trim()
                : primary?.mimeType ?? null,
              host: primary?.host || (typeof record.host === "string" ? record.host : "unknown"),
              downloadUrl,
              streamable: primary?.streamable ?? false,
              type: typeof alt.type === "string" && alt.type.trim()
                ? alt.type.trim()
                : null,
            });
          }
        }
      }
    }
  }

  if (downloads.length === 0) {
    throw new Error("No valid download links returned from Real-Debrid.");
  }

  return { downloads };
}

test("Real-Debrid Link Validation, Formatting & Normalization", async (t) => {
  await t.test("URL Validation: accepts valid HTTP and HTTPS absolute URLs", () => {
    const validHttps = validateLinkUrl("https://rapidgator.net/file/12345/archive.zip.html");
    assert.equal(validHttps.valid, true);
    assert.equal(validHttps.normalizedUrl, "https://rapidgator.net/file/12345/archive.zip.html");

    const validHttp = validateLinkUrl("http://turbobit.net/abc.html ");
    assert.equal(validHttp.valid, true);
    assert.equal(validHttp.normalizedUrl, "http://turbobit.net/abc.html");
  });

  await t.test("URL Validation: rejects empty, malformed, and non-HTTP protocols", () => {
    assert.equal(validateLinkUrl("").valid, false);
    assert.equal(validateLinkUrl("   ").valid, false);
    assert.equal(validateLinkUrl("not-a-valid-url").valid, false);

    const ftpResult = validateLinkUrl("ftp://files.example.com/movie.mkv");
    assert.equal(ftpResult.valid, false);
    assert.match(ftpResult.error, /Unsupported protocol \(ftp:\)/);

    const jsResult = validateLinkUrl("javascript:alert(document.cookie)");
    assert.equal(jsResult.valid, false);

    const dataResult = validateLinkUrl("data:text/plain;base64,SGVsbG8=");
    assert.equal(dataResult.valid, false);

    const fileResult = validateLinkUrl("file:///etc/passwd");
    assert.equal(fileResult.valid, false);
  });

  await t.test("Byte Formatter: converts bytes to standard human-readable sizes", () => {
    assert.equal(formatBytes(null), "UNKNOWN");
    assert.equal(formatBytes(undefined), "UNKNOWN");
    assert.equal(formatBytes(0), "UNKNOWN");
    assert.equal(formatBytes(-100), "UNKNOWN");
    assert.equal(formatBytes(NaN), "UNKNOWN");

    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(1024), "1 KB");
    assert.equal(formatBytes(842 * 1024), "842 KB");
    assert.equal(formatBytes(15000000), "14.3 MB");
    assert.equal(formatBytes(1932735283), "1.8 GB");
    assert.equal(formatBytes(5153960755), "4.8 GB");
    assert.equal(formatBytes(2308974411776), "2.1 TB");
  });

  await t.test("Check Normalization: handles supported hoster links", () => {
    const rawCheck = {
      host: "rapidgator.net",
      link: "https://rapidgator.net/file/123/sample.zip",
      filename: "sample.zip",
      filesize: 1572864000,
      supported: 1,
    };

    const result = normalizeCheckResponse(rawCheck, 200, "https://rapidgator.net/file/123/sample.zip");
    assert.equal(result.status, "supported");
    assert.equal(result.supported, true);
    assert.equal(result.host, "rapidgator.net");
    assert.equal(result.filename, "sample.zip");
    assert.equal(result.filesize, 1572864000);
    assert.equal(result.message, undefined);
  });

  await t.test("Check Normalization: handles unsupported hoster links", () => {
    const rawCheck = {
      host: "unsupportedhost.com",
      link: "https://unsupportedhost.com/file/123",
      filename: "",
      filesize: 0,
      supported: 0,
    };

    const result = normalizeCheckResponse(rawCheck, 200, "https://unsupportedhost.com/file/123");
    assert.equal(result.status, "unsupported");
    assert.equal(result.supported, false);
    assert.equal(result.host, "unsupportedhost.com");
    assert.equal(result.filesize, null);
    assert.match(result.message, /not report this link as supported/);
  });

  await t.test("Check Normalization: handles HTTP 503 file unavailable status", () => {
    const result = normalizeCheckResponse(null, 503, "https://rapidgator.net/file/dead");
    assert.equal(result.status, "file_unavailable");
    assert.equal(result.supported, false);
    assert.match(result.message, /currently unavailable/);
  });

  await t.test("Check Normalization: handles live Real-Debrid empty body responses as unsupported", () => {
    // Live Real-Debrid behavior for unsupported hosts or uncataloged links: HTTP 200 with empty body
    const resultFromNull = normalizeCheckResponse(null, 200, "https://example.com/file.zip");
    assert.equal(resultFromNull.status, "unsupported");
    assert.equal(resultFromNull.supported, false);
    assert.equal(resultFromNull.host, "example.com");
    assert.equal(resultFromNull.filename, null);
    assert.equal(resultFromNull.filesize, null);
    assert.match(resultFromNull.message, /not report this link as supported/);

    const resultFromEmptyStr = normalizeCheckResponse("", 200, "https://google.com/test");
    assert.equal(resultFromEmptyStr.status, "unsupported");
    assert.equal(resultFromEmptyStr.supported, false);
    assert.equal(resultFromEmptyStr.host, "google.com");
  });

  await t.test("Check Normalization: handles provider error responses", () => {
    const unsupportedHosterErr = {
      error: "hoster_unsupported",
      error_code: 16,
      host: "customhost.io",
    };

    const result = normalizeCheckResponse(unsupportedHosterErr, 200, "https://customhost.io/f/1");
    assert.equal(result.status, "unsupported");
    assert.equal(result.supported, false);
    assert.equal(result.host, "customhost.io");

    const fileUnavailableErr = {
      error: "file_unavailable",
      error_code: 24,
    };
    const resUnavailable = normalizeCheckResponse(fileUnavailableErr, 200, "https://rapidgator.net/file/dead");
    assert.equal(resUnavailable.status, "file_unavailable");
    assert.equal(resUnavailable.supported, false);
  });

  await t.test("Check Normalization: handles truly malformed or HTTP 500 error responses as error", () => {
    const error500 = normalizeCheckResponse("<html>Internal Server Error</html>", 500, "https://rapidgator.net/file/1");
    assert.equal(error500.status, "error");
    assert.equal(error500.supported, false);
    assert.match(error500.message, /HTTP status 500/);
  });

  await t.test("Unrestrict Normalization: normalizes single generated download link", () => {
    const singleResponse = {
      id: "ABCDEF123456",
      filename: "ubuntu-24.04.iso",
      mimeType: "application/x-iso9660-image",
      filesize: 6140000000,
      link: "https://example.com/file/ubuntu.iso",
      host: "example.com",
      chunks: 16,
      crc: 0,
      download: "https://download.real-debrid.com/d/ABCDEF123456/ubuntu-24.04.iso",
      streamable: 0,
    };

    const unrestrictResult = normalizeUnrestrictResponse(singleResponse);
    assert.equal(unrestrictResult.downloads.length, 1);

    const dl = unrestrictResult.downloads[0];
    assert.equal(dl.id, "ABCDEF123456");
    assert.equal(dl.filename, "ubuntu-24.04.iso");
    assert.equal(dl.filesize, 6140000000);
    assert.equal(dl.mimeType, "application/x-iso9660-image");
    assert.equal(dl.host, "example.com");
    assert.equal(dl.downloadUrl, "https://download.real-debrid.com/d/ABCDEF123456/ubuntu-24.04.iso");
    assert.equal(dl.streamable, false);
  });

  await t.test("Unrestrict Normalization: normalizes multi-quality / alternative responses into unified collection", () => {
    const multiResponse = {
      id: "YT1080P",
      filename: "documentary-full.mp4",
      filesize: 2980000000,
      link: "https://host.com/watch?v=sample",
      host: "host.com",
      chunks: 8,
      crc: 0,
      download: "https://download.real-debrid.com/d/YT1080P/documentary-1080p.mp4",
      streamable: 1,
      type: "1080p",
      alternative: [
        {
          id: "YT720P",
          filename: "documentary-720p.mp4",
          download: "https://download.real-debrid.com/d/YT720P/documentary-720p.mp4",
          type: "720p",
          filesize: 1490000000,
        },
        {
          id: "YTAUDIO",
          filename: "documentary-audio.m4a",
          download: "https://download.real-debrid.com/d/YTAUDIO/documentary-audio.m4a",
          type: "audio",
          filesize: 134217728,
        },
      ],
    };

    const unrestrictResult = normalizeUnrestrictResponse(multiResponse);
    assert.equal(unrestrictResult.downloads.length, 3);

    // Primary item
    assert.equal(unrestrictResult.downloads[0].id, "YT1080P");
    assert.equal(unrestrictResult.downloads[0].type, "1080p");
    assert.equal(unrestrictResult.downloads[0].streamable, true);

    // Alternative 1
    assert.equal(unrestrictResult.downloads[1].id, "YT720P");
    assert.equal(unrestrictResult.downloads[1].filename, "documentary-720p.mp4");
    assert.equal(unrestrictResult.downloads[1].type, "720p");
    assert.equal(unrestrictResult.downloads[1].filesize, 1490000000);

    // Alternative 2
    assert.equal(unrestrictResult.downloads[2].id, "YTAUDIO");
    assert.equal(unrestrictResult.downloads[2].filename, "documentary-audio.m4a");
    assert.equal(unrestrictResult.downloads[2].type, "audio");
    assert.equal(unrestrictResult.downloads[2].filesize, 134217728);
  });

  await t.test("Unrestrict Normalization: handles filesize 0 as unknown/null", () => {
    const rawUnknownSize = {
      id: "STREAM123",
      filename: "live_recording.mp4",
      filesize: 0, // Real-Debrid convention for unknown size
      host: "streamhost.net",
      download: "https://download.real-debrid.com/d/STREAM123/file.mp4",
      streamable: 1,
    };

    const unrestrictResult = normalizeUnrestrictResponse(rawUnknownSize);
    assert.equal(unrestrictResult.downloads[0].filesize, null);
    assert.equal(formatBytes(unrestrictResult.downloads[0].filesize), "UNKNOWN");
  });

  await t.test("Unrestrict Normalization: throws normalized error when provider reports failure", () => {
    assert.throws(
      () => {
        normalizeUnrestrictResponse({
          error: "bad_password",
          error_code: 13,
        });
      },
      { message: "Invalid host password provided." }
    );

    assert.throws(
      () => {
        normalizeUnrestrictResponse({
          error: "file_unavailable",
          error_code: 24,
        });
      },
      { message: "The source file is unavailable." }
    );
  });
});
