"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatBytes } from "@/lib/formatters";
import type {
  RealDebridTorrentInfo,
  RealDebridTorrentStatus,
  UnrestrictedDownload,
  UnrestrictResult,
} from "@/features/real-debrid/server/types";
import styles from "./page.module.css";

interface RealDebridTorrentToolProps {
  isConnected: boolean;
  isPremium: boolean;
}

const POLLING_INTERVAL_MS = 3500;
const MAX_CONSECUTIVE_POLL_ERRORS = 4;

export function RealDebridTorrentTool({
  isConnected,
  isPremium,
}: RealDebridTorrentToolProps) {
  const [magnetInput, setMagnetInput] = useState("");
  const [torrentId, setTorrentId] = useState<string | null>(null);
  const [torrentInfo, setTorrentInfo] = useState<RealDebridTorrentInfo | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());

  // Action loading states
  const [isAddingMagnet, setIsAddingMagnet] = useState(false);
  const [isSelectingFiles, setIsSelectingFiles] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnrestrictingAll, setIsUnrestrictingAll] = useState(false);

  // Results & Errors
  const [unrestrictedDownloads, setUnrestrictedDownloads] = useState<UnrestrictedDownload[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Polling tracker ref
  const pollErrorCountRef = useRef(0);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Quick client-side magnet validation
  function validateClientMagnet(raw: string): string | null {
    if (!raw.trim()) {
      return "Please enter a valid BitTorrent magnet URI.";
    }
    const trimmed = raw.trim();
    if (!trimmed.toLowerCase().startsWith("magnet:?")) {
      return "Invalid magnet URI format. Must begin with 'magnet:?'.";
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "magnet:") {
        return "Unsupported protocol. Must be a 'magnet:' URI.";
      }
      const xt = parsed.searchParams.getAll("xt");
      if (!xt || xt.length === 0 || !xt.some((x) => x.toLowerCase().includes("urn:bt"))) {
        return "Magnet URI is missing a valid BitTorrent info hash (urn:btih: or urn:btmh:).";
      }
    } catch {
      return "Malformed magnet URI syntax.";
    }
    return null;
  }

  // Fetch torrent info by ID
  const fetchTorrentInfo = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/integrations/real-debrid/torrents/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        pollErrorCountRef.current += 1;
        if (pollErrorCountRef.current >= MAX_CONSECUTIVE_POLL_ERRORS) {
          setErrorMessage(data.error || "Failed to update torrent status from Real-Debrid.");
        }
        return null;
      }

      pollErrorCountRef.current = 0;
      const info = data.torrent as RealDebridTorrentInfo;
      setTorrentInfo(info);

      // If we just reached waiting_files_selection and selectedFileIds is empty, initialize from provider
      if (info.status === "waiting_files_selection" && info.files && info.files.length > 0) {
        setSelectedFileIds((prev) => {
          if (prev.size === 0) {
            const initial = new Set<number>();
            info.files.forEach((f) => {
              if (f.selected) initial.add(f.id);
            });
            return initial;
          }
          return prev;
        });
      }

      return info;
    } catch {
      pollErrorCountRef.current += 1;
      if (pollErrorCountRef.current >= MAX_CONSECUTIVE_POLL_ERRORS) {
        setErrorMessage("Network error updating torrent status.");
      }
      return null;
    }
  }, []);

  // Polling loop effect
  useEffect(() => {
    if (!torrentId) {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      return;
    }

    const currentStatus = torrentInfo?.status;
    const shouldPoll =
      !currentStatus ||
      currentStatus === "magnet_conversion" ||
      currentStatus === "queued" ||
      currentStatus === "downloading" ||
      currentStatus === "processing";

    if (!shouldPoll) {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      return;
    }

    // Set up polling interval
    pollingTimerRef.current = setInterval(() => {
      fetchTorrentInfo(torrentId);
    }, POLLING_INTERVAL_MS);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [torrentId, torrentInfo?.status, fetchTorrentInfo]);

  // Handle Add Magnet submit
  async function handleAddMagnet(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setUnrestrictedDownloads([]);

    if (!isConnected) {
      setErrorMessage("Real-Debrid is not connected. Please connect your account first.");
      return;
    }
    if (!isPremium) {
      setErrorMessage("Torrent operations require an active Real-Debrid Premium subscription.");
      return;
    }

    const validationError = validateClientMagnet(magnetInput);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsAddingMagnet(true);
    pollErrorCountRef.current = 0;

    try {
      const res = await fetch("/api/integrations/real-debrid/torrents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ magnet: magnetInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to add magnet link.");
        setIsAddingMagnet(false);
        return;
      }

      const newId = data.id as string;
      setTorrentId(newId);
      // Immediately fetch initial info
      await fetchTorrentInfo(newId);
    } catch {
      setErrorMessage("Network error connecting to Daemon server.");
    } finally {
      setIsAddingMagnet(false);
    }
  }

  // Handle File Selection submit
  async function handleSelectFiles() {
    if (!torrentId) return;
    setErrorMessage(null);

    if (selectedFileIds.size === 0) {
      setErrorMessage("Please select at least one file to download.");
      return;
    }

    setIsSelectingFiles(true);
    try {
      const fileIdArray = Array.from(selectedFileIds);
      const res = await fetch(`/api/integrations/real-debrid/torrents/${encodeURIComponent(torrentId)}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: fileIdArray }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to submit file selection.");
      } else {
        // Immediately fetch updated info to transition to queued/downloading/downloaded
        await fetchTorrentInfo(torrentId);
      }
    } catch {
      setErrorMessage("Network error submitting file selection.");
    } finally {
      setIsSelectingFiles(false);
    }
  }

  // Handle Delete / Cancel torrent
  async function handleDeleteTorrent() {
    if (!torrentId) return;
    setErrorMessage(null);
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/integrations/real-debrid/torrents/${encodeURIComponent(torrentId)}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to remove torrent from Real-Debrid.");
      } else {
        handleReset();
      }
    } catch {
      setErrorMessage("Network error removing torrent.");
    } finally {
      setIsDeleting(false);
    }
  }

  // Handle Unrestricting all completed links
  async function handleUnrestrictCompletedLinks() {
    if (!torrentInfo || !torrentInfo.links || torrentInfo.links.length === 0) {
      setErrorMessage("No generated torrent links available to unrestrict.");
      return;
    }

    setIsUnrestrictingAll(true);
    setErrorMessage(null);

    const allDownloads: UnrestrictedDownload[] = [];
    const failedLinks: string[] = [];

    for (const link of torrentInfo.links) {
      try {
        const res = await fetch("/api/integrations/real-debrid/links/unrestrict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ link }),
        });

        const data = await res.json();
        if (res.ok && data.downloads) {
          const unrestrictResult = data as UnrestrictResult;
          allDownloads.push(...unrestrictResult.downloads);
        } else {
          failedLinks.push(link);
        }
      } catch {
        failedLinks.push(link);
      }
    }

    setUnrestrictedDownloads(allDownloads);
    if (failedLinks.length > 0) {
      setErrorMessage(
        `Generated ${allDownloads.length} direct link(s). ${failedLinks.length} link(s) could not be unrestricted.`
      );
    }
    setIsUnrestrictingAll(false);
  }

  // Copy helper
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

  // Reset workflow
  function handleReset() {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    setMagnetInput("");
    setTorrentId(null);
    setTorrentInfo(null);
    setSelectedFileIds(new Set());
    setUnrestrictedDownloads([]);
    setErrorMessage(null);
    setIsAddingMagnet(false);
    setIsSelectingFiles(false);
    setIsDeleting(false);
    setIsUnrestrictingAll(false);
    pollErrorCountRef.current = 0;
  }

  // File selection helpers
  function toggleFile(fileId: number) {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }

  function handleSelectAllFiles() {
    if (!torrentInfo?.files) return;
    const all = new Set<number>();
    torrentInfo.files.forEach((f) => all.add(f.id));
    setSelectedFileIds(all);
  }

  function handleClearSelection() {
    setSelectedFileIds(new Set());
  }

  // Calculate selected total size
  const totalSelectedBytes = (torrentInfo?.files || [])
    .filter((f) => selectedFileIds.has(f.id))
    .reduce((acc, f) => acc + f.bytes, 0);

  const status: RealDebridTorrentStatus | "idle" = torrentInfo
    ? torrentInfo.status
    : torrentId
    ? "magnet_conversion"
    : "idle";

  const isPollingActive =
    torrentId !== null &&
    (status === "magnet_conversion" ||
      status === "queued" ||
      status === "downloading" ||
      status === "processing");

  return (
    <div className={styles.torrentToolContainer}>
      {/* 1. IDLE STATE: Magnet Input Form */}
      {status === "idle" && (
        <form onSubmit={handleAddMagnet} className={styles.linkToolForm}>
          <div className={styles.formRow}>
            <div className={styles.inputGroup}>
              <label htmlFor="rd-magnet-url" className={styles.inputLabel}>
                BITTORRENT MAGNET URI <span className={styles.requiredMark}>*</span>
              </label>
              <textarea
                id="rd-magnet-url"
                rows={3}
                className={styles.textInput}
                placeholder="magnet:?xt=urn:btih:...&dn=..."
                value={magnetInput}
                onChange={(e) => {
                  setMagnetInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isAddingMagnet}
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          </div>

          <div className={styles.formActions}>
            <div className={styles.primaryActionButtons}>
              <button
                type="submit"
                id="rd-btn-add-magnet"
                className={`system-btn system-btn-primary ${styles.toolBtn}`}
                disabled={isAddingMagnet || !magnetInput.trim() || !isConnected || !isPremium}
                title={
                  !isConnected
                    ? "Connect Real-Debrid first"
                    : !isPremium
                    ? "Requires Real-Debrid Premium"
                    : "Add magnet link to Real-Debrid"
                }
              >
                {isAddingMagnet ? "ADDING MAGNET..." : "ADD MAGNET"}
              </button>
            </div>

            {(magnetInput || errorMessage) && (
              <button
                type="button"
                className={`system-btn ${styles.resetBtn}`}
                onClick={handleReset}
                disabled={isAddingMagnet}
              >
                CLEAR
              </button>
            )}
          </div>
        </form>
      )}

      {/* Error Callout */}
      {errorMessage && (
        <div className={`${styles.banner} ${styles.bannerError}`} style={{ marginTop: "14px" }}>
          <span>⚠</span>
          <span className="mono">{errorMessage}</span>
        </div>
      )}

      {/* 2. ACTIVE WORKFLOW CONTAINER */}
      {status !== "idle" && torrentInfo && (
        <div className={styles.activeTorrentCard}>
          {/* Header & Status Ribbon */}
          <div className={styles.torrentCardHeader}>
            <div className={styles.torrentHeaderTitleGroup}>
              <span className={styles.torrentCardLabel}>ACTIVE TORRENT PIPELINE</span>
              <span className={styles.torrentFilename} title={torrentInfo.filename}>
                {torrentInfo.filename}
              </span>
            </div>

            <div className={styles.torrentHeaderBadges}>
              {status === "magnet_conversion" && (
                <span className="badge badge-warning">
                  <span className="status-dot status-dot-warning" />
                  MAGNET CONVERSION
                </span>
              )}
              {status === "waiting_files_selection" && (
                <span className="badge badge-warning">
                  <span className="status-dot status-dot-warning" />
                  WAITING FOR FILE SELECTION
                </span>
              )}
              {status === "queued" && (
                <span className="badge badge-warning">
                  <span className="status-dot status-dot-warning" />
                  QUEUED
                </span>
              )}
              {status === "downloading" && (
                <span className="badge badge-online">
                  <span className="status-dot status-dot-online" />
                  DOWNLOADING ({torrentInfo.progress}%)
                </span>
              )}
              {status === "processing" && (
                <span className="badge badge-online">
                  <span className="status-dot status-dot-online" />
                  PROCESSING ({torrentInfo.rawStatus.toUpperCase()})
                </span>
              )}
              {status === "downloaded" && (
                <span className="badge badge-online">
                  <span className="status-dot status-dot-online" />
                  DOWNLOADED (100%)
                </span>
              )}
              {(status === "error" || status === "dead" || status === "virus") && (
                <span className="badge badge-offline">
                  <span className="status-dot status-dot-offline" />
                  {status.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar (Visible during transfer / completed) */}
          {(status === "downloading" ||
            status === "queued" ||
            status === "processing" ||
            status === "downloaded") && (
            <div className={styles.progressBarWrapper}>
              <div className={styles.progressBarTrack}>
                <div
                  className={`${styles.progressBarFill} ${
                    status === "downloaded" ? styles.progressBarFillComplete : ""
                  }`}
                  style={{ width: `${Math.max(2, torrentInfo.progress)}%` }}
                />
              </div>
              <div className={styles.progressMetaRow}>
                <span className="mono">PROGRESS: {torrentInfo.progress}%</span>
                {status === "downloading" && (
                  <span className="mono">
                    SPEED: {torrentInfo.speed ? `${formatBytes(torrentInfo.speed)}/s` : "—"}
                  </span>
                )}
                <span className="mono">
                  SIZE: {formatBytes(torrentInfo.bytes || torrentInfo.originalBytes)}
                </span>
              </div>
            </div>
          )}

          {/* Telemetry Metrics Grid */}
          <div className={styles.torrentMetricsGrid}>
            <div className={styles.infoBox}>
              <div className={styles.infoBoxLabel}>Torrent ID</div>
              <div className={styles.infoBoxValue} style={{ fontSize: "12px" }}>
                {torrentInfo.id}
              </div>
            </div>

            <div className={styles.infoBox}>
              <div className={styles.infoBoxLabel}>Total / Selected Size</div>
              <div className={styles.infoBoxValue}>
                {formatBytes(torrentInfo.bytes || torrentInfo.originalBytes)}
              </div>
            </div>

            {torrentInfo.speed !== null && (
              <div className={styles.infoBox}>
                <div className={styles.infoBoxLabel}>Transfer Speed</div>
                <div className={`${styles.infoBoxValue} ${styles.infoBoxValueHighlight}`}>
                  {formatBytes(torrentInfo.speed)}/s
                </div>
              </div>
            )}

            {torrentInfo.seeders !== null && (
              <div className={styles.infoBox}>
                <div className={styles.infoBoxLabel}>Active Seeders</div>
                <div className={styles.infoBoxValue}>{torrentInfo.seeders.toLocaleString()}</div>
              </div>
            )}

            <div className={styles.infoBox}>
              <div className={styles.infoBoxLabel}>Pipeline State</div>
              <div className={styles.infoBoxValue}>
                {status.replace(/_/g, " ").toUpperCase()}
              </div>
            </div>
          </div>

          {/* 3. MAGNET CONVERSION STATE */}
          {status === "magnet_conversion" && (
            <div className={styles.stateNoticeCard}>
              <div className={styles.waitingIndicator}>
                <div className={styles.pulseDot} />
                <span>RESOLVING MAGNET METADATA VIA REAL-DEBRID SWARM...</span>
              </div>
              <p className={styles.stateNoticeText}>
                The magnet link was submitted. Real-Debrid is currently contacting DHT/trackers to
                retrieve the torrent file manifest and file list.
              </p>
            </div>
          )}

          {/* 4. FILE SELECTION STATE */}
          {status === "waiting_files_selection" && (
            <div className={styles.fileSelectionSection}>
              <div className={styles.fileSelectionHeader}>
                <div className={styles.fileSelectionTitleGroup}>
                  <span className={styles.fileSelectionTitle}>TORRENT FILE MANIFEST</span>
                  <span className={styles.fileSelectionCount}>
                    {selectedFileIds.size} of {torrentInfo.files.length} files selected (
                    {formatBytes(totalSelectedBytes)})
                  </span>
                </div>

                <div className={styles.fileSelectionQuickActions}>
                  <button
                    type="button"
                    className={`system-btn ${styles.fileQuickBtn}`}
                    onClick={handleSelectAllFiles}
                    disabled={isSelectingFiles}
                  >
                    SELECT ALL
                  </button>
                  <button
                    type="button"
                    className={`system-btn ${styles.fileQuickBtn}`}
                    onClick={handleClearSelection}
                    disabled={isSelectingFiles}
                  >
                    CLEAR
                  </button>
                </div>
              </div>

              {/* Scrollable File List */}
              <div className={styles.fileListContainer}>
                {torrentInfo.files.map((file) => {
                  const isChecked = selectedFileIds.has(file.id);
                  return (
                    <div
                      key={file.id}
                      className={`${styles.fileItemRow} ${isChecked ? styles.fileItemRowSelected : ""}`}
                      onClick={() => toggleFile(file.id)}
                    >
                      <input
                        type="checkbox"
                        className={styles.fileCheckbox}
                        checked={isChecked}
                        onChange={() => toggleFile(file.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${file.path}`}
                      />
                      <span className={styles.filePathText} title={file.path}>
                        {file.path}
                      </span>
                      <span className={styles.fileSizeBytes}>{formatBytes(file.bytes)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Start Download Action */}
              <div className={styles.fileSelectionFooter}>
                <button
                  type="button"
                  id="rd-btn-start-torrent-download"
                  className={`system-btn system-btn-primary ${styles.startDownloadBtn}`}
                  onClick={handleSelectFiles}
                  disabled={isSelectingFiles || selectedFileIds.size === 0}
                >
                  {isSelectingFiles
                    ? "SUBMITTING SELECTION..."
                    : `START DOWNLOAD WITH ${selectedFileIds.size} SELECTED FILE(S)`}
                </button>
              </div>
            </div>
          )}

          {/* 5. DOWNLOADED / COMPLETED STATE */}
          {status === "downloaded" && (
            <div className={styles.completedSection}>
              <div className={styles.completedHeader}>
                <div className={styles.completedTitleGroup}>
                  <span className={styles.completedTitle}>TORRENT DOWNLOAD READY</span>
                  <span className="mono" style={{ fontSize: "11px", color: "var(--status-online-text)" }}>
                    ✓ CACHED ON REAL-DEBRID ({torrentInfo.links.length} HOST URLS AVAILABLE)
                  </span>
                </div>

                {unrestrictedDownloads.length === 0 && (
                  <button
                    type="button"
                    id="rd-btn-unrestrict-torrent-links"
                    className={`system-btn system-btn-primary ${styles.toolBtn}`}
                    onClick={handleUnrestrictCompletedLinks}
                    disabled={isUnrestrictingAll}
                  >
                    {isUnrestrictingAll
                      ? "UNRESTRICTING LINKS..."
                      : `GENERATE ${torrentInfo.links.length} DIRECT DOWNLOAD LINK(S)`}
                  </button>
                )}
              </div>

              {/* Unrestricted Direct Download Cards */}
              {unrestrictedDownloads.length > 0 && (
                <div className={styles.downloadsList} style={{ marginTop: "14px" }}>
                  {unrestrictedDownloads.map((download, index) => {
                    const isCopied = copiedId === download.id;
                    return (
                      <div key={download.id} className={styles.downloadItemCard}>
                        <div className={styles.downloadItemHeader}>
                          <div className={styles.downloadIndex}>
                            [ {String(index + 1).padStart(2, "0")} ]
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
                              id={`rd-btn-copy-torrent-${download.id}`}
                              className={`system-btn ${styles.copyBtn} ${isCopied ? styles.copiedBtn : ""}`}
                              onClick={() => handleCopyUrl(download.downloadUrl, download.id)}
                            >
                              {isCopied ? "✓ COPIED" : "COPY URL"}
                            </button>

                            <a
                              id={`rd-link-open-torrent-${download.id}`}
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
              )}
            </div>
          )}

          {/* Footer Actions (Cancel / Reset / Polling status) */}
          <div className={styles.torrentCardFooter}>
            <div className={styles.pollingIndicatorContainer}>
              {isPollingActive ? (
                <span className={styles.livePollingBadge}>
                  <span className={styles.pulseDot} />
                  LIVE POLLING (3.5S)
                </span>
              ) : (
                <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  STATUS: {status.replace(/_/g, " ").toUpperCase()}
                </span>
              )}
            </div>

            <div className={styles.torrentFooterButtons}>
              <button
                type="button"
                className={`system-btn ${styles.dangerBtn}`}
                onClick={handleDeleteTorrent}
                disabled={isDeleting}
              >
                {isDeleting ? "REMOVING..." : "REMOVE TORRENT FROM REAL-DEBRID"}
              </button>

              {(status === "downloaded" ||
                status === "error" ||
                status === "dead" ||
                status === "virus") && (
                <button
                  type="button"
                  className={`system-btn ${styles.resetBtn}`}
                  onClick={handleReset}
                >
                  START NEW TORRENT
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
