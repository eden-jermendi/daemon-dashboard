import { auth } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ModuleTile } from "@/components/dashboard/module-tile";
import { getRealDebridConnectionStatus } from "@/features/real-debrid/server/connection";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: session } = await auth.getSession();
  const userName = session?.user?.name ?? null;
  const userEmail = session?.user?.email ?? null;
  const userId = session?.user?.id ?? null;

  const rdStatus = await getRealDebridConnectionStatus(userId);

  return (
    <div className={styles.mainLayout}>
      <DashboardHeader userName={userName} userEmail={userEmail} />

      <main className={styles.content}>
        <div className={styles.systemBanner}>
          <div className={styles.bannerText}>
            CONTROL PLANE ACTIVE — MODULAR SERVICES GRID
          </div>
          <div className={styles.bannerMeta}>NODE: LOCALHOST | ENV: DEV</div>
        </div>

        <div className={styles.grid}>
          {/* Prominent Module: Real-Debrid */}
          <ModuleTile
            title="REAL-DEBRID"
            status={rdStatus.isConnected ? "CONNECTED" : "NOT CONFIGURED"}
            statusType={rdStatus.isConnected ? "online" : "warning"}
            colSpan={8}
            destination="/modules/real-debrid"
            actionLabel="OPEN"
            footerNote="PRIMARY INTEGRATION TARGET"
          >
            <p className={styles.moduleDescription}>
              High-speed unrestricted link downloader and media torrent pipeline.
              Authentication via 3-legged OAuth2 web flow.
            </p>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Auth Protocol</span>
              <span className={styles.specVal}>OAuth2 Web Flow (Server-side)</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Connection State</span>
              <span className={styles.specVal}>
                {rdStatus.isConnected ? "Connected (Encrypted)" : "Disconnected"}
              </span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Features</span>
              <span className={styles.specVal}>OAuth2 Active, Status & Debrid Engine in Milestones 3-5</span>
            </div>
          </ModuleTile>

          {/* Stremio Switch Module */}
          <ModuleTile
            title="STREMIO SWITCH"
            status="NOT INTEGRATED"
            statusType="muted"
            colSpan={4}
            footerNote="STANDALONE SERVICE"
          >
            <p className={styles.moduleDescription}>
              Multi-profile configuration switcher for Stremio. Currently operates
              as an independent application.
            </p>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Status</span>
              <span className={styles.specVal}>Separate Repository</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specKey}>Integration</span>
              <span className={styles.specVal}>Deferred to Milestone 6</span>
            </div>
          </ModuleTile>

          {/* Generic Future Slot 1 */}
          <ModuleTile
            title="AVAILABLE MODULE SLOT"
            status="EMPTY"
            statusType="empty"
            colSpan={4}
            isPlaceholder={true}
          >
            <div className={styles.slotPlaceholderContent}>
              <span>SLOT 01 : UNALLOCATED</span>
              <span style={{ fontSize: "11px", marginTop: "4px" }}>
                Ready for future feature module
              </span>
            </div>
          </ModuleTile>

          {/* Generic Future Slot 2 */}
          <ModuleTile
            title="AVAILABLE MODULE SLOT"
            status="EMPTY"
            statusType="empty"
            colSpan={4}
            isPlaceholder={true}
          >
            <div className={styles.slotPlaceholderContent}>
              <span>SLOT 02 : UNALLOCATED</span>
              <span style={{ fontSize: "11px", marginTop: "4px" }}>
                Ready for future feature module
              </span>
            </div>
          </ModuleTile>

          {/* Generic Future Slot 3 */}
          <ModuleTile
            title="HOMELAB & INTEGRATIONS"
            status="RESERVED"
            statusType="muted"
            colSpan={4}
            isPlaceholder={true}
          >
            <div className={styles.slotPlaceholderContent}>
              <span>SLOT 03 : RESERVED</span>
              <span style={{ fontSize: "11px", marginTop: "4px" }}>
                Infrastructure & telemetry control
              </span>
            </div>
          </ModuleTile>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>DAEMON DASHBOARD v0.1.0</span>
          <span>MODULAR MONOLITH ARCHITECTURE</span>
        </div>
      </footer>
    </div>
  );
}
