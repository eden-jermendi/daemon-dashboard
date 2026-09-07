import {
  getRealDebridAccount,
  formatExpirationDate,
  formatPremiumRemaining,
} from "@/features/real-debrid/server/account";
import styles from "./page.module.css";

interface RealDebridAccountTelemetryProps {
  userId: string;
}

/**
 * Understated fallback skeleton matching the utilitarian design system.
 * Uses identical grid and box styling to prevent layout shifts.
 */
export function RealDebridAccountSkeleton() {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>ACCOUNT STATUS & SUBSCRIPTION</h2>
      <div className={styles.infoGrid}>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxLabel}>Username</div>
          <div className={styles.infoBoxValue}>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>QUERYING...</span>
          </div>
        </div>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxLabel}>Account Tier</div>
          <div className={styles.infoBoxValue}>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>QUERYING...</span>
          </div>
        </div>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxLabel}>Expiration Date</div>
          <div className={styles.infoBoxValue}>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>QUERYING...</span>
          </div>
        </div>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxLabel}>Premium Remaining</div>
          <div className={styles.infoBoxValue}>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>QUERYING...</span>
          </div>
        </div>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxLabel}>Fidelity Points</div>
          <div className={styles.infoBoxValue}>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>QUERYING...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Async Server Component that fetches live Real-Debrid account telemetry.
 * Isolated behind React Suspense so slow external provider requests do not block the page shell.
 */
export async function RealDebridAccountTelemetry({ userId }: RealDebridAccountTelemetryProps) {
  const accountResult = await getRealDebridAccount(userId);

  if (accountResult.status === "error") {
    return (
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>ACCOUNT STATUS & SUBSCRIPTION</h2>
        <div className={`${styles.banner} ${styles.bannerWarning}`}>
          <span>⚠</span>
          <span>
            REAL-DEBRID API WARNING: {accountResult.message || "Provider temporarily unavailable."}
          </span>
        </div>
      </div>
    );
  }

  if (accountResult.status !== "connected") {
    return null;
  }

  const { account } = accountResult;

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>ACCOUNT STATUS & SUBSCRIPTION</h2>
      <div className={styles.infoGrid}>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxLabel}>Username</div>
          <div className={styles.infoBoxValue}>{account.username}</div>
        </div>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxLabel}>Account Tier</div>
          <div className={styles.infoBoxValue}>
            {account.isPremium ? (
              <span className="badge badge-online" style={{ fontSize: "10px", padding: "2px 6px" }}>
                PREMIUM
              </span>
            ) : (
              <span className="badge badge-warning" style={{ fontSize: "10px", padding: "2px 6px" }}>
                FREE
              </span>
            )}
          </div>
        </div>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxLabel}>Expiration Date</div>
          <div className={styles.infoBoxValue}>
            {formatExpirationDate(account.expiration, "full")}
          </div>
        </div>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxLabel}>Premium Remaining</div>
          <div className={styles.infoBoxValue}>
            <span className={account.isPremium ? styles.infoBoxValueHighlight : ""}>
              {formatPremiumRemaining(account.premiumRemainingSeconds)}
            </span>
          </div>
        </div>
        <div className={styles.infoBox}>
          <div className={styles.infoBoxLabel}>Fidelity Points</div>
          <div className={styles.infoBoxValue}>
            {account.fidelityPoints.toLocaleString()} PTS
          </div>
        </div>
      </div>
    </div>
  );
}
