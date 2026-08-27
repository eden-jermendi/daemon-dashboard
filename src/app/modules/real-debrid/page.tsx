import Link from "next/link";
import { auth } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getRealDebridConnectionStatus } from "@/features/real-debrid/server/connection";
import { RealDebridConnectClient } from "./real-debrid-connect-client";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface RealDebridModulePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function formatDate(date: Date | null): string {
  if (!date) return "N/A";
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  const hrs = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  const secs = date.getSeconds().toString().padStart(2, "0");
  return `${d}-${m}-${y} ${hrs}:${mins}:${secs}`;
}

export default async function RealDebridModulePage({
  searchParams,
}: RealDebridModulePageProps) {
  const params = await searchParams;
  const { data: session } = await auth.getSession();
  const userName = session?.user?.name ?? null;
  const userEmail = session?.user?.email ?? null;
  const userId = session?.user?.id ?? null;

  const status = await getRealDebridConnectionStatus(userId);

  const successParam = typeof params.success === "string" ? params.success : null;
  const errorParam = typeof params.error === "string" ? params.error : null;

  let bannerMessage: { type: "success" | "error"; text: string } | null = null;

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
              bannerMessage.type === "success" ? styles.bannerSuccess : styles.bannerError
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
            {status.isConnected ? (
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
            {status.isConnected ? (
              <div className={styles.statusCardConnected}>
                <div className={styles.statusCardHeaderConnected}>STATUS: OPERATIONAL</div>
                <div className={styles.statusCardState}>REAL-DEBRID CONNECTED</div>
                <p className={styles.statusCardText}>
                  Daemon Dashboard possesses a valid, encrypted OAuth2 authorization for your Real-Debrid account.
                  Credentials are automatically refreshed server-side using the documented provider flow.
                </p>
                <div className={styles.statusActions}>
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
                    {status.updatedAt ? formatDate(status.updatedAt) : "Never"}
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
                  <div className={styles.infoBoxValue}>Subscription & Expiration Watch</div>
                </div>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Link Unrestriction (Milestone 4)</div>
                  <div className={styles.infoBoxValue}>Direct & Batch Debrid Engine</div>
                </div>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Torrent Pipeline (Milestone 5)</div>
                  <div className={styles.infoBoxValue}>Magnet Ingestion & Monitoring</div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.panelFooter}>
            <span className="mono" style={{ color: "var(--text-muted)" }}>
              MILESTONE 2B : OAUTH2 BOUNDARY ACTIVE
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
