import Link from "next/link";
import { auth } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function RealDebridModulePage() {
  const { data: session } = await auth.getSession();
  const userEmail = session?.user?.email ?? null;

  return (
    <div className={styles.mainLayout}>
      <DashboardHeader currentModule="REAL-DEBRID" userEmail={userEmail} />

      <main className={styles.content}>
        <div className={styles.navBar}>
          <Link href="/" className={styles.backLink}>
            ← BACK TO DAEMON DASHBOARD
          </Link>
        </div>

        <div className={styles.modulePanel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <h1 className={styles.panelTitle}>REAL-DEBRID</h1>
              <span className={styles.panelSubtitle}>
                MODULE ID: MOD-REALDEBRID-01
              </span>
            </div>
            <span className="badge badge-warning">
              <span className="status-dot status-dot-warning" />
              NOT CONFIGURED
            </span>
          </div>

          <div className={styles.panelBody}>
            {/* Status Section */}
            <div className={styles.statusCard}>
              <div className={styles.statusCardHeader}>STATUS</div>
              <div className={styles.statusCardState}>NOT CONFIGURED</div>
              <p className={styles.statusCardText}>
                No Real-Debrid provider credentials or active OAuth2 sessions are
                configured for this Daemon Dashboard instance.
              </p>
            </div>

            {/* Architecture / Roadmap notes */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>PLANNED CAPABILITIES</h2>
              <div className={styles.infoGrid}>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Authentication Flow</div>
                  <div className={styles.infoBoxValue}>OAuth2 Web Flow (Server-side)</div>
                </div>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Account Status</div>
                  <div className={styles.infoBoxValue}>Subscription & Expiration Watch</div>
                </div>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Link Unrestriction</div>
                  <div className={styles.infoBoxValue}>Direct & Batch Debrid Engine</div>
                </div>
                <div className={styles.infoBox}>
                  <div className={styles.infoBoxLabel}>Torrent Pipeline</div>
                  <div className={styles.infoBoxValue}>Magnet Ingestion & Monitoring</div>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>SECURITY NOTICE</h2>
              <p className={styles.statusCardText}>
                Per project security constraints, Real-Debrid API tokens and OAuth2
                secrets are strictly handled server-side and never exposed to the
                browser. Integration will be configured in Milestone 2B and Milestone 3.
              </p>
            </div>
          </div>

          <div className={styles.panelFooter}>
            <span className="mono" style={{ color: "var(--text-muted)" }}>
              MILESTONE 2A : AUTH BOUNDARY ACTIVE
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
