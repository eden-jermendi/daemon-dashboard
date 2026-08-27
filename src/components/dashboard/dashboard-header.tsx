import Link from "next/link";
import styles from "./dashboard-header.module.css";

interface DashboardHeaderProps {
  currentModule?: string;
}

export function DashboardHeader({ currentModule }: DashboardHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brandGroup}>
          <Link href="/" className={styles.title}>
            DAEMON DASHBOARD
          </Link>
          {currentModule ? (
            <span className={styles.subtitle}>/ {currentModule}</span>
          ) : (
            <span className={styles.subtitle}>CONTROL PLANE v0.1.0</span>
          )}
        </div>

        <div className={styles.systemStatus}>
          <span className={styles.statusLabel}>SYSTEM:</span>
          <span className="badge badge-online">
            <span className="status-dot status-dot-online" />
            ONLINE
          </span>
        </div>
      </div>
    </header>
  );
}
