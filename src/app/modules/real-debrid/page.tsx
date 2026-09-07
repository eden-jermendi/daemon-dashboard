import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getRealDebridConnectionStatus } from "@/features/real-debrid/server/connection";
import { formatExpirationDate } from "@/features/real-debrid/server/account";
import { RealDebridConnectClient } from "./real-debrid-connect-client";
import {
  RealDebridAccountTelemetry,
  RealDebridAccountSkeleton,
} from "./real-debrid-account-telemetry";
import { RealDebridLinkTool } from "./real-debrid-link-tool";
import { RealDebridTorrentTool } from "./real-debrid-torrent-tool";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface RealDebridModulePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RealDebridModulePage({
  searchParams,
}: RealDebridModulePageProps) {
  const params = await searchParams;
  const { data: session } = await auth.getSession();
  const userName = session?.user?.name ?? null;
  const userEmail = session?.user?.email ?? null;
  const userId = session?.user?.id ?? null;

  const connectionStatus = await getRealDebridConnectionStatus(userId);

  const successParam = typeof params.success === "string" ? params.success : null;
  const errorParam = typeof params.error === "string" ? params.error : null;

  let bannerMessage: { type: "success" | "error" | "warning"; text: string } | null = null;

  if (successParam === "connected") {
    bannerMessage = {
      type: "success",
      text: "REAL-DEBRID CONNECTED: OAuth2 authorization established and encrypted.",
    };
  } else if (successParam === "disconnected") {
    bannerMessage = {
      type: "success",
      text: "REAL-DEBRID DISCONNECTED: Stored authorization credentials removed.",
    };
  } else if (errorParam === "disconnect_failed") {
    bannerMessage = {
      type: "error",
      text: "DISCONNECT WARNING: Error occurred while clearing provider credentials.",
    };
  }

  const isConnected = connectionStatus.isConnected;

  return (
    <div className={styles.mainLayout}>
      <DashboardHeader currentModule="REAL-DEBRID" userName={userName} userEmail={userEmail} />

      <main className={styles.content}>
        <div className={styles.navBar}>
          <Link href="/" className={styles.backLink}>
            ← BACK TO DAEMON DASHBOARD
          </Link>
        </div>

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

        <div className={styles.modulePanel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <h1 className={styles.panelTitle}>REAL-DEBRID</h1>
              <span className={styles.panelSubtitle}>
                MODULE ID: MOD-REALDEBRID-01
              </span>
            </div>
            {isConnected ? (
              <span className="badge badge-online">
                <span className="status-dot status-dot-online" />
                CONNECTED
              </span>
            ) : (
              <span className="badge badge-warning">
                <span className="status-dot status-dot-warning" />
                NOT CONNECTED
              </span>
            )}
          </div>

          <div className={styles.panelBody}>
            {/* Status Section */}
            {isConnected ? (
              <div className={styles.statusCardConnected}>
                <div className={styles.statusCardHeaderConnected}>STATUS: OPERATIONAL</div>
                <div className={styles.statusCardState}>
                  REAL-DEBRID CONNECTED
                </div>
                <p className={styles.statusCardText}>
                  Daemon Dashboard possesses a valid, encrypted OAuth2 authorization for your Real-Debrid account.
                  Credentials are automatically refreshed server-side using the documented provider flow.
                </p>
                <div className={styles.statusActions}>
                  <a
                    href="https://real-debrid.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`system-btn system-btn-primary ${styles.portalBtn}`}
                  >
                    OPEN REAL-DEBRID PORTAL ↗
                  </a>
                  <form action="/api/integrations/real-debrid/disconnect" method="POST">
                    <button type="submit" className={`system-btn ${styles.dangerBtn}`}>
                      DISCONNECT REAL-DEBRID
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <RealDebridConnectClient />
            )}

            {/* Live Account Status (Milestone 3) - Streaming via React Suspense */}
            {isConnected && userId && (
              <Suspense fallback={<RealDebridAccountSkeleton />}>
                <RealDebridAccountTelemetry userId={userId} />
              </Suspense>
            )}

            {/* Interactive Link Tool (Milestone 4) */}
            <div className={styles.section}>
              <div className={styles.sectionHeaderRow}>
                <h2 className={styles.sectionTitle}>LINK CHECK & UNRESTRICTION TOOL</h2>
                <span className="badge badge-online" style={{ fontSize: "10px", padding: "2px 6px" }}>
                  CONTROL PLANE ACTIVE
                </span>
              </div>
              <RealDebridLinkTool
                isConnected={isConnected}
                isPremium={isConnected}
              />
            </div>

            {/* Interactive Magnet & Torrent Pipeline Tool (Milestone 5) */}
            <div className={styles.section}>
              <div className={styles.sectionHeaderRow}>
                <h2 className={styles.sectionTitle}>MAGNET / TORRENT PIPELINE</h2>
                <span className="badge badge-online" style={{ fontSize: "10px", padding: "2px 6px" }}>
                  WORKFLOW ACTIVE
                </span>
              </div>
              <RealDebridTorrentTool
                isConnected={isConnected}
                isPremium={isConnected}
              />
            </div>

            {/* Connection Information */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>AUTHENTICATION & CREDENTIAL SECURITY</h2>
              <div className={styles.infoGrid}>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>OAuth2 Protocol</div>
                  <div className={styles.infoBoxValue}>Open-Source Device Flow (X245A4XAIBGVM)</div>
                </div>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Credential Storage</div>
                  <div className={styles.infoBoxValue}>AES-256-GCM Encrypted</div>
                </div>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Refresh Mechanism</div>
                  <div className={styles.infoBoxValue}>Documented Device Grant</div>
                </div>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Last Synchronized</div>
                  <div className={styles.infoBoxValue}>
                    {formatExpirationDate(connectionStatus.updatedAt, "full")}
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture / Roadmap notes */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>PLANNED CAPABILITIES</h2>
              <div className={styles.infoGrid}>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Account Status (Milestone 3)</div>
                  <div className={styles.infoBoxValue}>
                    <span className="badge badge-online" style={{ fontSize: "10px", padding: "2px 6px" }}>
                      ACTIVE
                    </span>
                  </div>
                </div>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Link Unrestriction (Milestone 4)</div>
                  <div className={styles.infoBoxValue}>
                    <span className="badge badge-online" style={{ fontSize: "10px", padding: "2px 6px" }}>
                      ACTIVE
                    </span>
                  </div>
                </div>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Torrent Pipeline (Milestone 5)</div>
                  <div className={styles.infoBoxValue}>
                    <span className="badge badge-online" style={{ fontSize: "10px", padding: "2px 6px" }}>
                      ACTIVE
                    </span>
                  </div>
                </div>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Stremio Switch (Milestone 6)</div>
                  <div className={styles.infoBoxValue}>Integration Assessment (Planned)</div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.panelFooter}>
            <span className="mono" style={{ color: "var(--text-muted)" }}>
              MILESTONE 5 : MAGNET & TORRENT WORKFLOW ACTIVE
            </span>
            <Link href="/" className="system-btn">
              RETURN TO DASHBOARD
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
