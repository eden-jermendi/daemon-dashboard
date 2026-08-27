"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import styles from "./dashboard-header.module.css";

interface DashboardHeaderProps {
  currentModule?: string;
  userName?: string | null;
  userEmail?: string | null;
}

export function DashboardHeader({ currentModule, userName, userEmail }: DashboardHeaderProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      router.push("/auth/sign-in");
      router.refresh();
    } catch {
      router.push("/auth/sign-in");
    }
  };

  const displayName = userName || (userEmail ? userEmail.split("@")[0] : null);

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

        <div className={styles.systemControls}>
          <div className={styles.systemStatus}>
            <span className={styles.statusLabel}>SYSTEM:</span>
            <span className="badge badge-online">
              <span className="status-dot status-dot-online" />
              ONLINE
            </span>
          </div>

          <div className={styles.systemStatus}>
            <span className={styles.statusLabel}>SESSION:</span>
            <span className="badge badge-online">
              {displayName ? displayName.toUpperCase() : "AUTHENTICATED"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className={styles.signOutBtn}
            title="Sign out of Daemon Dashboard"
          >
            [ SIGN OUT ]
          </button>
        </div>
      </div>
    </header>
  );
}
