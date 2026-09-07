import { auth } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ModuleTile } from "@/components/dashboard/module-tile";
import {
  getRealDebridAccount,
  formatExpirationDate,
  formatPremiumRemaining,
} from "@/features/real-debrid/server/account";
import { getUserStremioConfig } from "@/features/stremio-switch/server/service.ts";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: session } = await auth.getSession();
  const userName = session?.user?.name ?? null;
  const userEmail = session?.user?.email ?? null;
  const userId = session?.user?.id ?? null;

  const accountResult = await getRealDebridAccount(userId);
  const stremioConfig = userId ? await getUserStremioConfig(userId, "torrentio") : null;

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
          {accountResult.status === "connected" ? (
            accountResult.account.isPremium ? (
              <ModuleTile
                title="REAL-DEBRID"
                status="PREMIUM ACTIVE"
                statusType="online"
                colSpan={8}
                destination="/modules/real-debrid"
                actionLabel="OPEN"
                footerNote="ACTIVE PROVIDER INTEGRATION"
              >
                <p className={styles.moduleDescription}>
                  High-speed unrestricted link downloader and media torrent pipeline for{" "}
                  <strong>{accountResult.account.username}</strong>.
                </p>
                <div className={styles.specRow}>
                  <span className={styles.specKey}>Account Tier</span>
                  <span className={styles.specVal}>Premium</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specKey}>Expiration</span>
                  <span className={styles.specVal}>
                    {formatExpirationDate(accountResult.account.expiration, "short")}
                  </span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specKey}>Remaining</span>
                  <span className={styles.specVal}>
                    {formatPremiumRemaining(accountResult.account.premiumRemainingSeconds)}
                  </span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specKey}>Fidelity Points</span>
                  <span className={styles.specVal}>
                    {accountResult.account.fidelityPoints.toLocaleString()} PTS
                  </span>
                </div>
              </ModuleTile>
            ) : (
              <ModuleTile
                title="REAL-DEBRID"
                status="FREE ACCOUNT"
                statusType="warning"
                colSpan={8}
                destination="/modules/real-debrid"
                actionLabel="OPEN"
                footerNote="ACTIVE PROVIDER INTEGRATION"
              >
                <p className={styles.moduleDescription}>
                  Connected to Real-Debrid as{" "}
                  <strong>{accountResult.account.username}</strong> (Non-Premium tier).
                </p>
                <div className={styles.specRow}>
                  <span className={styles.specKey}>Account Tier</span>
                  <span className={styles.specVal}>Free</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specKey}>Remaining</span>
                  <span className={styles.specVal}>No Premium Active</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specKey}>Fidelity Points</span>
                  <span className={styles.specVal}>
                    {accountResult.account.fidelityPoints.toLocaleString()} PTS
                  </span>
                </div>
              </ModuleTile>
            )
          ) : accountResult.status === "error" ? (
            <ModuleTile
              title="REAL-DEBRID"
              status="API UNAVAILABLE"
              statusType="warning"
              colSpan={8}
              destination="/modules/real-debrid"
              actionLabel="OPEN"
              footerNote="CONNECTION RETRYING"
            >
              <p className={styles.moduleDescription}>
                Real-Debrid credentials are encrypted and stored, but the provider API
                is temporarily unreachable.
              </p>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Connection State</span>
                <span className={styles.specVal}>Connected (Encrypted)</span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Provider API</span>
                <span className={styles.specVal}>Temporarily Unavailable</span>
              </div>
            </ModuleTile>
          ) : (
            <ModuleTile
              title="REAL-DEBRID"
              status="NOT CONFIGURED"
              statusType="warning"
              colSpan={8}
              destination="/modules/real-debrid"
              actionLabel="OPEN"
              footerNote="PRIMARY INTEGRATION TARGET"
            >
              <p className={styles.moduleDescription}>
                High-speed unrestricted link downloader and media torrent pipeline.
                Authentication via official open-source device OAuth flow.
              </p>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Auth Protocol</span>
                <span className={styles.specVal}>Open-Source Device Flow (Server-side)</span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Connection State</span>
                <span className={styles.specVal}>Disconnected</span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Features</span>
                <span className={styles.specVal}>
                  Account Status, Link Unrestriction, Torrents
                </span>
              </div>
            </ModuleTile>
          )}

          {/* Stremio Switch Module */}
          {stremioConfig ? (
            <ModuleTile
              title="STREMIO SWITCH"
              status={stremioConfig.capabilityConfigured ? "ADDON ACTIVE" : "CONFIGURED"}
              statusType={stremioConfig.capabilityConfigured ? "online" : "warning"}
              colSpan={4}
              destination="/modules/stremio-switch"
              actionLabel="OPEN"
              footerNote="NATIVE STREMIO ADDON PROXY"
            >
              <p className={styles.moduleDescription}>
                Torrentio stream proxy with dynamic Real-Debrid OAuth credential injection and capability routing.
              </p>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Provider</span>
                <span className={styles.specVal}>Torrentio (Configured)</span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Capability</span>
                <span className={styles.specVal}>
                  {stremioConfig.capabilityConfigured
                    ? stremioConfig.capabilityHint || "Active"
                    : "Not Generated / Revoked"}
                </span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Sort Policy</span>
                <span className={styles.specVal}>
                  {stremioConfig.publicConfig.sort || "quality"}
                </span>
              </div>
            </ModuleTile>
          ) : (
            <ModuleTile
              title="STREMIO SWITCH"
              status="NOT CONFIGURED"
              statusType="muted"
              colSpan={4}
              destination="/modules/stremio-switch"
              actionLabel="CONFIGURE"
              footerNote="STREMIO CONTROL PLANE"
            >
              <p className={styles.moduleDescription}>
                Multi-profile configuration switcher and capability proxy for Stremio addons.
              </p>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Provider</span>
                <span className={styles.specVal}>Torrentio (Ready)</span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specKey}>Integration</span>
                <span className={styles.specVal}>Native Module</span>
              </div>
            </ModuleTile>
          )}

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
