"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/formatters";
import type {
  RealDebridLinkCheckResult,
  UnrestrictResult,
  UnrestrictedDownload,
} from "@/features/real-debrid/server/types";
import styles from "./page.module.css";

interface RealDebridLinkToolProps {
  isConnected: boolean;
  isPremium: boolean;
}

export function RealDebridLinkTool({
  isConnected,
  isPremium,
}: RealDebridLinkToolProps) {
  const [urlInput, setUrlInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isUnrestricting, setIsUnrestricting] = useState(false);
  const [checkResult, setCheckResult] = useState<RealDebridLinkCheckResult | null>(null);
  const [unrestrictResult, setUnrestrictResult] = useState<UnrestrictResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Client-side quick protocol validation
  function validateClientUrl(url: string): string | null {
    if (!url.trim()) {
      return "Please enter a valid hoster or file URL.";
    }
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return `Unsupported protocol (${parsed.protocol}). Only HTTP and HTTPS URLs are allowed.`;
      }
    } catch {
      return "Invalid URL format. Please enter a complete HTTP or HTTPS link.";
    }
    return null;
  }

  async function handleCheckLink(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setUnrestrictResult(null);

    const validationError = validateClientUrl(urlInput);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsChecking(true);
    try {
      const res = await fetch("/api/integrations/real-debrid/links/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          link: urlInput.trim(),
          password: passwordInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to check link support.");
        setCheckResult(null);
      } else {
        setCheckResult(data as RealDebridLinkCheckResult);
        if (data.status === "error" && data.message) {
          setErrorMessage(data.message);
        }
      }
    } catch {
      setErrorMessage("Network error communicating with Daemon server.");
    } finally {
      setIsChecking(false);
    }
  }

  async function handleUnrestrictLink(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!isConnected) {
      setErrorMessage("Real-Debrid account is not connected. Please connect your account first.");
      return;
    }

    if (!isPremium) {
      setErrorMessage("Link unrestriction requires an active Real-Debrid Premium subscription.");
      return;
    }

    const validationError = validateClientUrl(urlInput);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsUnrestricting(true);
    try {
      const res = await fetch("/api/integrations/real-debrid/links/unrestrict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          link: urlInput.trim(),
          password: passwordInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to unrestrict link.");
      } else {
        setUnrestrictResult(data as UnrestrictResult);
      }
    } catch {
      setErrorMessage("Network error communicating with Daemon server.");
    } finally {
      setIsUnrestricting(false);
    }
  }

  async function handleCopyUrl(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 2500);
    } catch {
      setErrorMessage("Unable to copy URL to clipboard.");
    }
  }

  function handleReset() {
    setUrlInput("");
    setPasswordInput("");
    setCheckResult(null);
    setUnrestrictResult(null);
    setErrorMessage(null);
  }

  const isBusy = isChecking || isUnrestricting;

  return (
    <div className={styles.linkToolContainer}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (checkResult?.supported && isConnected && isPremium) {
            handleUnrestrictLink(e);
          } else {
            handleCheckLink(e);
          }
        }}
        className={styles.linkToolForm}
      >
        <div className={styles.formRow}>
          <div className={styles.inputGroup}>
            <label htmlFor="rd-link-url" className={styles.inputLabel}>
              HOST URL <span className={styles.requiredMark}>*</span>
            </label>
            <input
              id="rd-link-url"
              type="text"
              className={styles.textInput}
              placeholder="https://examplehost.com/file/..."
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={isBusy}
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.inputGroup}>
            <label htmlFor="rd-host-password" className={styles.inputLabel}>
              HOST PASSWORD <span className={styles.optionalMark}>[ OPTIONAL / EPHEMERAL ]</span>
            </label>
            <input
              id="rd-host-password"
              type="password"
              className={styles.textInput}
              placeholder="Password to unlock host-side file (if protected)"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              disabled={isBusy}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className={styles.formActions}>
          <div className={styles.primaryActionButtons}>
            <button
              type="button"
              id="rd-btn-check-link"
              className={`system-btn ${styles.toolBtn}`}
              onClick={() => handleCheckLink()}
              disabled={isBusy || !urlInput.trim()}
            >
              {isChecking ? "CHECKING LINK..." : "CHECK LINK"}
            </button>

            <button
              type="button"
              id="rd-btn-unrestrict-link"
              className={`system-btn system-btn-primary ${styles.toolBtn}`}
              onClick={() => handleUnrestrictLink()}
              disabled={isBusy || !urlInput.trim() || !isConnected || !isPremium}
              title={
                !isConnected
                  ? "Connect Real-Debrid first"
                  : !isPremium
                  ? "Requires Premium Real-Debrid account"
                  : "Unrestrict and generate direct download link"
              }
            >
              {isUnrestricting ? "UNRESTRICTING..." : "UNRESTRICT"}
            </button>
          </div>

          {(urlInput || checkResult || unrestrictResult || errorMessage) && (
            <button
              type="button"
              className={`system-btn ${styles.resetBtn}`}
              onClick={handleReset}
              disabled={isBusy}
            >
              CLEAR
            </button>
          )}
        </div>
      </form>

      {/* Error Callout */}
      {errorMessage && (
        <div className={`${styles.banner} ${styles.bannerError}`} style={{ marginTop: "16px" }}>
          <span>⚠</span>
          <span className="mono">{errorMessage}</span>
        </div>
      )}

      {/* Check Link Result Card */}
      {checkResult && (
        <div className={styles.resultSection}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultCardTitle}>LINK VERIFICATION STATUS</span>
            {checkResult.status === "supported" && (
              <span className="badge badge-online">
                <span className="status-dot status-dot-online" />
                SUPPORTED
              </span>
            )}
            {checkResult.status === "unsupported" && (
              <span className="badge badge-warning">
                <span className="status-dot status-dot-warning" />
                UNSUPPORTED
              </span>
            )}
            {checkResult.status === "file_unavailable" && (
              <span className="badge badge-offline">
                <span className="status-dot status-dot-offline" />
                FILE UNAVAILABLE
              </span>
            )}
            {checkResult.status === "error" && (
              <span className="badge badge-offline">
                <span className="status-dot status-dot-offline" />
                CHECK ERROR
              </span>
            )}
          </div>

          <div className={styles.resultDetailsGrid}>
            <div className={styles.infoBox}>
              <div className={styles.infoBoxLabel}>Hoster Domain</div>
              <div className={styles.infoBoxValue}>{checkResult.host || "Unknown / Not Detected"}</div>
            </div>
            <div className={styles.infoBox}>
              <div className={styles.infoBoxLabel}>Detected File Name</div>
              <div className={styles.infoBoxValue} title={checkResult.filename || undefined}>
                {checkResult.filename || "—"}
              </div>
            </div>
            <div className={styles.infoBox}>
              <div className={styles.infoBoxLabel}>Reported File Size</div>
              <div className={styles.infoBoxValue}>{formatBytes(checkResult.filesize)}</div>
            </div>
            <div className={styles.infoBox}>
              <div className={styles.infoBoxLabel}>Debrid Support</div>
              <div className={styles.infoBoxValue}>
                {checkResult.supported ? "Available for Unrestriction" : "Unsupported or Offline"}
              </div>
            </div>
          </div>

          {checkResult.supported && !unrestrictResult && (
            <div className={styles.checkCardFooter}>
              <button
                type="button"
                className={`system-btn system-btn-primary ${styles.quickUnrestrictBtn}`}
                onClick={() => handleUnrestrictLink()}
                disabled={isBusy || !isConnected || !isPremium}
              >
                {isUnrestricting ? "UNRESTRICTING..." : "UNRESTRICT THIS FILE →"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Unrestricted Direct Download Result */}
      {unrestrictResult && unrestrictResult.downloads.length > 0 && (
        <div className={styles.unrestrictSection}>
          <div className={styles.unrestrictHeader}>
            <span className={styles.unrestrictTitle}>
              {unrestrictResult.downloads.length === 1
                ? "UNRESTRICTED DIRECT DOWNLOAD"
                : `${unrestrictResult.downloads.length} GENERATED DIRECT DOWNLOADS`}
            </span>
            <span className="badge badge-online">
              <span className="status-dot status-dot-online" />
              READY FOR DATA PLANE
            </span>
          </div>

          <div className={styles.downloadsList}>
            {unrestrictResult.downloads.map((download: UnrestrictedDownload, index: number) => {
              const isCopied = copiedId === download.id;

              return (
                <div key={download.id} className={styles.downloadItemCard}>
                  <div className={styles.downloadItemHeader}>
                    <div className={styles.downloadIndex}>
                      {unrestrictResult.downloads.length > 1
                        ? `[ ${String(index + 1).padStart(2, "0")} ]`
                        : "DIRECT FILE"}
                    </div>
                    <div className={styles.downloadItemName} title={download.filename}>
                      {download.filename}
                    </div>
                    {download.type && (
                      <span className={styles.qualityTag}>{download.type}</span>
                    )}
                    {download.streamable && (
                      <span className={styles.streamableTag}>STREAMABLE</span>
                    )}
                  </div>

                  <div className={styles.downloadItemMeta}>
                    <span className={styles.metaLabel}>HOST:</span>
                    <span className={styles.metaValue}>{download.host}</span>
                    <span className={styles.metaDivider}>|</span>
                    <span className={styles.metaLabel}>SIZE:</span>
                    <span className={styles.metaValue}>{formatBytes(download.filesize)}</span>
                    {download.mimeType && (
                      <>
                        <span className={styles.metaDivider}>|</span>
                        <span className={styles.metaLabel}>MIME:</span>
                        <span className={styles.metaValue}>{download.mimeType}</span>
                      </>
                    )}
                  </div>

                  <div className={styles.downloadLinkRow}>
                    <div className={styles.directUrlPreview} title={download.downloadUrl}>
                      <span className={styles.urlPrefix}>DIRECT URL:</span>
                      <span className={styles.urlText}>{download.downloadUrl}</span>
                    </div>

                    <div className={styles.downloadActions}>
                      <button
                        type="button"
                        id={`rd-btn-copy-${download.id}`}
                        className={`system-btn ${styles.copyBtn} ${isCopied ? styles.copiedBtn : ""}`}
                        onClick={() => handleCopyUrl(download.downloadUrl, download.id)}
                      >
                        {isCopied ? "✓ COPIED" : "COPY URL"}
                      </button>

                      <a
                        id={`rd-link-open-${download.id}`}
                        href={download.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`system-btn system-btn-primary ${styles.openBtn}`}
                      >
                        OPEN DIRECT URL ↗
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.unrestrictNotice}>
            <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              DIRECT DATA PLANE HANDOFF: File bytes flow directly from Real-Debrid infrastructure to your browser or external download manager. Daemon Dashboard acts strictly as the authenticated control plane.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
