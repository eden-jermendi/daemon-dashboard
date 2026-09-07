"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ALLOWED_DEBRID_OPTIONS,
  ALLOWED_LANGUAGES,
  ALLOWED_PROVIDERS,
  ALLOWED_QUALITIES,
  ALLOWED_SORTS,
  TorrentioDebridOption,
  TorrentioPublicConfig,
  TorrentioSort,
} from "@/features/stremio-switch/domain/torrentio";
import type { StremioProviderConfigDto } from "@/features/stremio-switch/server/types";
import styles from "./page.module.css";

interface StremioSwitchClientProps {
  initialConfig: StremioProviderConfigDto | null;
  isRdConnected: boolean;
}

interface OneTimeCapabilityState {
  capability: string;
  hint: string;
  httpsUrl: string;
  stremioUrl: string;
}

const DEFAULT_POPULAR_PROVIDERS = [
  "yts",
  "eztv",
  "rarbg",
  "1337x",
  "thepiratebay",
  "torrentgalaxy",
  "magnetdl",
  "nyaasi",
];

export function StremioSwitchClient({
  initialConfig,
  isRdConnected,
}: StremioSwitchClientProps) {
  const [config, setConfig] = useState<StremioProviderConfigDto | null>(
    initialConfig
  );
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Status message
  const [bannerMessage, setBannerMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  // Modals
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [oneTimeDisplay, setOneTimeDisplay] =
    useState<OneTimeCapabilityState | null>(null);
  const [copied, setCopied] = useState(false);

  // Form State
  const [providers, setProviders] = useState<string[]>(
    config?.publicConfig.providers || DEFAULT_POPULAR_PROVIDERS
  );
  const [sort, setSort] = useState<TorrentioSort>(
    config?.publicConfig.sort || "quality"
  );
  const [priorityLanguages, setPriorityLanguages] = useState<string[]>(
    config?.publicConfig.priorityLanguages || []
  );
  const [qualityFilters, setQualityFilters] = useState<string[]>(
    config?.publicConfig.qualityFilters || ["scr", "cam"]
  );
  const [limit, setLimit] = useState<number | "">(
    config?.publicConfig.limit || ""
  );
  const [sizeFilter, setSizeFilter] = useState<string>(
    config?.publicConfig.sizeFilter || ""
  );
  const [debridOptions, setDebridOptions] = useState<TorrentioDebridOption[]>(
    config?.publicConfig.debridOptions || []
  );

  // Sync form state when config updates
  const syncFormFromConfig = (newConfig: StremioProviderConfigDto) => {
    setConfig(newConfig);
    if (newConfig.publicConfig.providers) {
      setProviders(newConfig.publicConfig.providers);
    }
    if (newConfig.publicConfig.sort) {
      setSort(newConfig.publicConfig.sort);
    }
    if (newConfig.publicConfig.priorityLanguages) {
      setPriorityLanguages(newConfig.publicConfig.priorityLanguages);
    }
    if (newConfig.publicConfig.qualityFilters) {
      setQualityFilters(newConfig.publicConfig.qualityFilters);
    }
    if (newConfig.publicConfig.limit !== undefined) {
      setLimit(newConfig.publicConfig.limit);
    }
    if (newConfig.publicConfig.sizeFilter !== undefined) {
      setSizeFilter(newConfig.publicConfig.sizeFilter);
    }
    if (newConfig.publicConfig.debridOptions) {
      setDebridOptions(newConfig.publicConfig.debridOptions);
    }
  };

  // 1. URL Import Handler
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUrl = importUrl.trim();
    if (!rawUrl) return;

    setImportLoading(true);
    setBannerMessage(null);

    try {
      const res = await fetch("/api/integrations/stremio/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "torrentio",
          url: rawUrl,
        }),
      });

      // Clear input immediately for security
      setImportUrl("");

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import configuration.");
      }

      syncFormFromConfig(data);
      setBannerMessage({
        type: "success",
        text: "TORRENTIO CONFIGURATION IMPORTED: Public settings extracted and saved. Any provider credentials in the URL were immediately discarded.",
      });
    } catch (err) {
      setBannerMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to import Torrentio configuration.",
      });
    } finally {
      setImportLoading(false);
    }
  };

  // 2. Structured Config Save Handler
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setBannerMessage(null);

    try {
      const publicConfig: TorrentioPublicConfig = {
        providers,
        sort,
        priorityLanguages:
          priorityLanguages.length > 0 ? priorityLanguages : undefined,
        qualityFilters: qualityFilters.length > 0 ? qualityFilters : undefined,
        limit: typeof limit === "number" && limit > 0 ? limit : undefined,
        sizeFilter: sizeFilter.trim() ? sizeFilter.trim() : undefined,
        debridOptions: debridOptions.length > 0 ? debridOptions : undefined,
      };

      const res = await fetch("/api/integrations/stremio/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "torrentio",
          publicConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save configuration.");
      }

      syncFormFromConfig(data);
      setBannerMessage({
        type: "success",
        text: "TORRENTIO CONFIGURATION SAVED: Active capability preserved with updated options.",
      });
    } catch (err) {
      setBannerMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to save Torrentio configuration.",
      });
    } finally {
      setSaveLoading(false);
    }
  };

  // 3. Rotate / Generate Capability
  const executeRotateCapability = async () => {
    if (!config?.id) {
      setBannerMessage({
        type: "warning",
        text: "Please save a Torrentio configuration before generating an addon capability.",
      });
      return;
    }

    setActionLoading(true);
    setBannerMessage(null);

    try {
      const res = await fetch(
        `/api/integrations/stremio/providers/${config.id}/rotate`,
        {
          method: "POST",
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate capability.");
      }

      const rawToken = data.capability as string;
      const hint = data.capabilityHint as string;

      const origin = window.location.origin;
      const host = window.location.host;
      const httpsUrl = `${origin}/api/stremio/${rawToken}/manifest.json`;
      const stremioUrl = `stremio://${host}/api/stremio/${rawToken}/manifest.json`;

      // Update state
      setConfig({
        ...config,
        capabilityConfigured: true,
        capabilityHint: hint,
      });

      setShowRotateConfirm(false);
      setOneTimeDisplay({
        capability: rawToken,
        hint,
        httpsUrl,
        stremioUrl,
      });
    } catch (err) {
      setBannerMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to rotate addon capability.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Revoke Capability
  const executeRevokeCapability = async () => {
    if (!config?.id) return;

    setActionLoading(true);
    setBannerMessage(null);

    try {
      const res = await fetch(
        `/api/integrations/stremio/providers/${config.id}/revoke`,
        {
          method: "POST",
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke capability.");
      }

      setConfig({
        ...config,
        capabilityConfigured: false,
        capabilityHint: null,
      });

      setShowRevokeConfirm(false);
      setBannerMessage({
        type: "success",
        text: "CAPABILITY REVOKED: Currently installed addon URLs will immediately fail. Configuration settings are preserved.",
      });
    } catch (err) {
      setBannerMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to revoke addon capability.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Clipboard copy
  const handleCopyHttps = async () => {
    if (!oneTimeDisplay?.httpsUrl) return;
    try {
      await navigator.clipboard.writeText(oneTimeDisplay.httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Dismiss one-time display (strictly clears plaintext token from memory)
  const handleDismissOneTime = () => {
    setOneTimeDisplay(null);
    setCopied(false);
  };

  // Helper toggle functions for checkbox arrays
  const toggleArrayItem = <T extends string>(
    current: T[],
    item: T,
    setter: (val: T[]) => void
  ) => {
    if (current.includes(item)) {
      setter(current.filter((i) => i !== item));
    } else {
      setter([...current, item]);
    }
  };

  const isConfigured = Boolean(config);
  const isCapabilityActive = Boolean(config?.capabilityConfigured);

  return (
    <>
      {bannerMessage && (
        <div
          className={`${styles.banner} ${
            bannerMessage.type === "success"
              ? styles.bannerSuccess
              : bannerMessage.type === "warning"
              ? styles.bannerWarning
              : styles.bannerError
          }`}
        >
          <span>{bannerMessage.type === "success" ? "✓" : "⚠"}</span>
          <span>{bannerMessage.text}</span>
        </div>
      )}

      {/* 1. Status Section */}
      <div className={styles.statusGrid}>
        {/* Provider Config Status */}
        <div className={styles.statusCard}>
          <div className={styles.statusCardHeader}>
            <span>Provider Engine</span>
            <span
              className={`badge ${
                isConfigured ? "badge-online" : "badge-muted"
              }`}
            >
              {isConfigured ? "CONFIGURED" : "UNCONFIGURED"}
            </span>
          </div>
          <div className={styles.statusCardTitle}>Torrentio</div>
          <p className={styles.statusCardText}>
            Domain parser & serializer engine with runtime OAuth credential
            injection.
          </p>
          <div className={styles.statusCardMeta}>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Target URL</span>
              <span className={styles.metaVal}>torrentio.strem.fun</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Active Providers</span>
              <span className={styles.metaVal}>
                {providers.length} selected
              </span>
            </div>
          </div>
        </div>

        {/* Real-Debrid Integration Status */}
        <div className={styles.statusCard}>
          <div className={styles.statusCardHeader}>
            <span>Debrid Provider</span>
            <span
              className={`badge ${
                isRdConnected ? "badge-online" : "badge-warning"
              }`}
            >
              {isRdConnected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>
          <div className={styles.statusCardTitle}>Real-Debrid</div>
          <p className={styles.statusCardText}>
            {isRdConnected
              ? "Connected via Daemon OAuth. Ephemeral access tokens are injected at request time."
              : "No active Real-Debrid connection. Torrentio requires an authorized provider."}
          </p>
          <div className={styles.statusCardMeta}>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Auth Layer</span>
              <span className={styles.metaVal}>Daemon OAuth2 Bridge</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Credential Storage</span>
              <span className={styles.metaVal}>
                {isRdConnected ? "Zero Duplicate Secrets" : "Action Required"}
              </span>
            </div>
          </div>
          {!isRdConnected && (
            <div className={styles.cardActions}>
              <Link
                href="/modules/real-debrid"
                className="system-btn system-btn-primary"
                style={{ fontSize: "11px", padding: "4px 8px" }}
              >
                CONNECT REAL-DEBRID ↗
              </Link>
            </div>
          )}
        </div>

        {/* Addon Capability Status */}
        <div className={styles.statusCard}>
          <div className={styles.statusCardHeader}>
            <span>Capability Token</span>
            <span
              className={`badge ${
                isCapabilityActive ? "badge-online" : "badge-muted"
              }`}
            >
              {isCapabilityActive ? "ACTIVE" : "INACTIVE"}
            </span>
          </div>
          <div className={styles.statusCardTitle}>
            {isCapabilityActive ? "Addon Capability Active" : "No Active Addon"}
          </div>
          <p className={styles.statusCardText}>
            High-entropy bearer token stored only as SHA-256 hash. Plaintext
            token cannot be recovered from the database.
          </p>
          <div className={styles.statusCardMeta}>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Identifier Hint</span>
              <span className={styles.metaVal}>
                {config?.capabilityHint || "None"}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Storage Security</span>
              <span className={styles.metaVal}>SHA-256 Hash-Only</span>
            </div>
          </div>
          <div className={styles.cardActions}>
            {isCapabilityActive ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowRotateConfirm(true)}
                  disabled={actionLoading}
                  className="system-btn"
                  style={{ fontSize: "11px", padding: "4px 8px" }}
                >
                  ROTATE ADDON URL
                </button>
                <button
                  type="button"
                  onClick={() => setShowRevokeConfirm(true)}
                  disabled={actionLoading}
                  className={`system-btn ${styles.dangerBtn}`}
                  style={{ fontSize: "11px", padding: "4px 8px" }}
                >
                  REVOKE ACCESS
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (config?.id) {
                    executeRotateCapability();
                  } else {
                    setBannerMessage({
                      type: "warning",
                      text: "Please import or save your Torrentio settings below before generating a capability token.",
                    });
                  }
                }}
                disabled={actionLoading}
                className="system-btn system-btn-primary"
                style={{ fontSize: "11px", padding: "4px 8px" }}
              >
                GENERATE ADDON URL
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. URL Import Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <h2 className={styles.sectionTitle}>
            IMPORT EXISTING TORRENTIO CONFIGURATION
          </h2>
          <span
            className="badge badge-online"
            style={{ fontSize: "10px", padding: "2px 6px" }}
          >
            CREDENTIAL STRIPPING ACTIVE
          </span>
        </div>
        <p className={styles.sectionDescription}>
          Paste an existing configured Torrentio manifest URL (e.g. from an
          existing Stremio install). The domain parser will extract your public
          options and <strong>immediately discard</strong> any embedded
          Real-Debrid API token.
        </p>

        <form onSubmit={handleImport} className={styles.importBox}>
          <div className={styles.importInputGroup}>
            <input
              type="text"
              placeholder="https://torrentio.strem.fun/providers=yts,rarbg|sort=quality/manifest.json"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className={styles.importInput}
              disabled={importLoading}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={importLoading || !importUrl.trim()}
              className="system-btn system-btn-primary"
            >
              {importLoading ? "IMPORTING..." : "IMPORT CONFIGURATION"}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Structured Configuration Editor */}
      <div className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <h2 className={styles.sectionTitle}>
            STRUCTURED TORRENTIO CONFIGURATION
          </h2>
          <span
            className="badge badge-online"
            style={{ fontSize: "10px", padding: "2px 6px" }}
          >
            CANONICAL DOMAIN SCHEMA
          </span>
        </div>
        <p className={styles.sectionDescription}>
          Tune your public scraping options. Saving configuration preserves your
          existing capability URL—Stremio clients will immediately resolve
          streams using the updated settings.
        </p>

        <form onSubmit={handleSaveConfig} className={styles.formContainer}>
          {/* General Options Grid */}
          <div className={styles.formGrid}>
            {/* Sort */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Sort Policy</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as TorrentioSort)}
                className={styles.formSelect}
              >
                {Array.from(ALLOWED_SORTS).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className={styles.formHelp}>
                Stream ranking criteria for search results.
              </span>
            </div>

            {/* Result Limit */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>
                Max Results Per Resolution
              </label>
              <input
                type="number"
                min="1"
                max="100"
                placeholder="No limit"
                value={limit}
                onChange={(e) => {
                  const val = e.target.value;
                  setLimit(val === "" ? "" : parseInt(val, 10));
                }}
                className={styles.formInput}
              />
              <span className={styles.formHelp}>
                Maximum streams returned per quality group (1–100).
              </span>
            </div>

            {/* Size Filter */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Size Filter (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 10GB or 1GB,20GB"
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className={styles.formInput}
              />
              <span className={styles.formHelp}>
                Exclude streams outside size boundaries.
              </span>
            </div>
          </div>

          {/* Debrid Options */}
          <div className={styles.checkboxGroup}>
            <div className={styles.checkboxGroupHeader}>
              <label className={styles.formLabel}>Debrid Options</label>
            </div>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {Array.from(ALLOWED_DEBRID_OPTIONS).map((opt) => (
                <label key={opt} className={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={debridOptions.includes(opt)}
                    onChange={() =>
                      toggleArrayItem(debridOptions, opt, setDebridOptions)
                    }
                  />
                  <span>
                    {opt === "nodownloadlinks"
                      ? "Don't show download links"
                      : "Don't show Debrid catalog"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Providers Checkboxes */}
          <div className={styles.checkboxGroup}>
            <div className={styles.checkboxGroupHeader}>
              <label className={styles.formLabel}>
                Torrent Providers ({providers.length} Selected)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() =>
                    setProviders(Array.from(ALLOWED_PROVIDERS))
                  }
                  className={styles.quickToggleBtn}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setProviders(DEFAULT_POPULAR_PROVIDERS)}
                  className={styles.quickToggleBtn}
                >
                  Popular Only
                </button>
                <button
                  type="button"
                  onClick={() => setProviders([])}
                  className={styles.quickToggleBtn}
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className={styles.checkboxGrid}>
              {Array.from(ALLOWED_PROVIDERS).map((p) => (
                <label key={p} className={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={providers.includes(p)}
                    onChange={() =>
                      toggleArrayItem(providers, p, setProviders)
                    }
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Quality Exclusions */}
          <div className={styles.checkboxGroup}>
            <div className={styles.checkboxGroupHeader}>
              <label className={styles.formLabel}>
                Quality / Resolution Exclusions ({qualityFilters.length}{" "}
                Excluded)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setQualityFilters(["scr", "cam"])}
                  className={styles.quickToggleBtn}
                >
                  Default (CAM/SCR)
                </button>
                <button
                  type="button"
                  onClick={() => setQualityFilters([])}
                  className={styles.quickToggleBtn}
                >
                  Exclude None
                </button>
              </div>
            </div>
            <div className={styles.checkboxGrid}>
              {Array.from(ALLOWED_QUALITIES).map((q) => (
                <label key={q} className={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={qualityFilters.includes(q)}
                    onChange={() =>
                      toggleArrayItem(qualityFilters, q, setQualityFilters)
                    }
                  />
                  <span>{q}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Priority Languages */}
          <div className={styles.checkboxGroup}>
            <div className={styles.checkboxGroupHeader}>
              <label className={styles.formLabel}>
                Priority Languages ({priorityLanguages.length} Selected)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setPriorityLanguages([])}
                  className={styles.quickToggleBtn}
                >
                  Clear Languages
                </button>
              </div>
            </div>
            <div className={styles.checkboxGrid} style={{ maxHeight: "150px" }}>
              {Array.from(ALLOWED_LANGUAGES).map((lang) => (
                <label key={lang} className={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={priorityLanguages.includes(lang)}
                    onChange={() =>
                      toggleArrayItem(
                        priorityLanguages,
                        lang,
                        setPriorityLanguages
                      )
                    }
                  />
                  <span>{lang}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="submit"
              disabled={saveLoading}
              className="system-btn system-btn-primary"
            >
              {saveLoading ? "SAVING CONFIGURATION..." : "SAVE CONFIGURATION"}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL 1: Rotate Confirmation */}
      {showRotateConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>ROTATE ADDON CAPABILITY</h3>
              <button
                type="button"
                onClick={() => setShowRotateConfirm(false)}
                className="system-btn"
                style={{ padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div
                className={`${styles.banner} ${styles.bannerWarning}`}
                style={{ margin: 0 }}
              >
                <span>⚠</span>
                <span>
                  <strong>CRITICAL:</strong> Rotating will invalidate your
                  current Stremio addon URL immediately.
                </span>
              </div>
              <p>
                Any existing Stremio installation using the current URL will
                instantly receive <strong>404 Unknown Addon Capability</strong>.
              </p>
              <p>
                A new high-entropy capability token will be generated, and only
                its SHA-256 hash will be stored. You will need to install or
                update your Stremio client with the new URL.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setShowRotateConfirm(false)}
                disabled={actionLoading}
                className="system-btn"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={executeRotateCapability}
                disabled={actionLoading}
                className={`system-btn ${styles.warningBtn}`}
              >
                {actionLoading ? "ROTATING..." : "CONFIRM ROTATION"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Revoke Confirmation */}
      {showRevokeConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>REVOKE ADDON ACCESS</h3>
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(false)}
                className="system-btn"
                style={{ padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div
                className={`${styles.banner} ${styles.bannerError}`}
                style={{ margin: 0 }}
              >
                <span>⚠</span>
                <span>
                  <strong>WARNING:</strong> This will revoke all public Stremio
                  access through Daemon.
                </span>
              </div>
              <p>
                Your installed Stremio addon will cease functioning immediately.
                Your saved Torrentio options and Real-Debrid authorization
                remain intact.
              </p>
              <p>You can generate a new capability URL at any time.</p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(false)}
                disabled={actionLoading}
                className="system-btn"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={executeRevokeCapability}
                disabled={actionLoading}
                className={`system-btn ${styles.dangerBtn}`}
              >
                {actionLoading ? "REVOKING..." : "CONFIRM REVOCATION"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: One-Time Capability Display */}
      {oneTimeDisplay && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalDialog} style={{ maxWidth: "620px" }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>NEW ADDON CAPABILITY</h3>
              <button
                type="button"
                onClick={handleDismissOneTime}
                className="system-btn"
                style={{ padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.oneTimeCallout}>
                <div className={styles.oneTimeWarning}>
                  <span>🔒</span>
                  <span>
                    ONE-TIME DISPLAY: Daemon does not store this token in
                    plaintext and cannot recover it later.
                  </span>
                </div>
                <div className={styles.urlDisplayBox}>
                  {oneTimeDisplay.httpsUrl}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                  }}
                >
                  <span>Non-Secret Hint: {oneTimeDisplay.hint}</span>
                  <span style={{ color: "#238636", fontWeight: 700 }}>
                    ACTIVE IN DATABASE
                  </span>
                </div>
              </div>

              <p>
                Install the addon directly into the Stremio desktop application
                or copy the HTTPS URL to paste into Stremio&apos;s community
                search bar:
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <a
                  href={oneTimeDisplay.stremioUrl}
                  className="system-btn system-btn-primary"
                  style={{ textDecoration: "none" }}
                >
                  INSTALL IN STREMIO ↗
                </a>
                <button
                  type="button"
                  onClick={handleCopyHttps}
                  className="system-btn"
                >
                  {copied ? "COPIED TO CLIPBOARD ✓" : "COPY HTTPS URL"}
                </button>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <span
                style={{
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-muted)",
                  marginRight: "auto",
                }}
              >
                Dismissing permanently clears token from client memory.
              </span>
              <button
                type="button"
                onClick={handleDismissOneTime}
                className="system-btn system-btn-primary"
              >
                DONE (DISMISS)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
