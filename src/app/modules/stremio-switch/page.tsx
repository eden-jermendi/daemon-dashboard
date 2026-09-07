import Link from "next/link";
import { auth } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getRealDebridConnectionStatus } from "@/features/real-debrid/server/connection";
import { getUserStremioConfig } from "@/features/stremio-switch/server/service";
import { StremioSwitchClient } from "./stremio-switch-client";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function StremioSwitchModulePage() {
  const { data: session } = await auth.getSession();
  const userName = session?.user?.name ?? null;
  const userEmail = session?.user?.email ?? null;
  const userId = session?.user?.id ?? null;

  const connectionStatus = await getRealDebridConnectionStatus(userId);
  const initialConfig = userId
    ? await getUserStremioConfig(userId, "torrentio")
    : null;

  return (
    <div className={styles.mainLayout}>
      <DashboardHeader
        currentModule="STREMIO SWITCH"
        userName={userName}
        userEmail={userEmail}
      />

      <main className={styles.content}>
        <div className={styles.navBar}>
          <Link href="/" className={styles.backLink}>
            ← BACK TO DAEMON DASHBOARD
          </Link>
        </div>

        <div className={styles.modulePanel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <h1 className={styles.panelTitle}>STREMIO SWITCH</h1>
              <span className={styles.panelSubtitle}>
                MODULE ID: MOD-STREMIOSWITCH-01
              </span>
            </div>
            {initialConfig?.capabilityConfigured ? (
              <span className="badge badge-online">
                <span className="status-dot status-dot-online" />
                ADDON ACTIVE
              </span>
            ) : initialConfig ? (
              <span className="badge badge-warning">
                <span className="status-dot status-dot-warning" />
                CONFIGURED (INACTIVE)
              </span>
            ) : (
              <span className="badge badge-muted">
                <span className="status-dot" style={{ backgroundColor: "#8b949e" }} />
                NOT CONFIGURED
              </span>
            )}
          </div>

          <div className={styles.panelBody}>
            <StremioSwitchClient
              initialConfig={initialConfig}
              isRdConnected={connectionStatus.isConnected}
            />
          </div>

          <div className={styles.panelFooter}>
            <span className="mono" style={{ color: "var(--text-muted)" }}>
              STREMIO CAPABILITY PROXY & RESOLVER CONTROL PLANE
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
