import React from "react";
import Link from "next/link";
import styles from "./module-tile.module.css";

export type StatusType = "online" | "warning" | "muted" | "empty";

export interface ModuleTileProps {
  title: string;
  status?: string;
  statusType?: StatusType;
  colSpan?: 4 | 6 | 8 | 12;
  destination?: string;
  actionLabel?: string;
  footerNote?: string;
  isPlaceholder?: boolean;
  children?: React.ReactNode;
}

export function ModuleTile({
  title,
  status,
  statusType = "muted",
  colSpan = 6,
  destination,
  actionLabel = "OPEN",
  footerNote,
  isPlaceholder = false,
  children,
}: ModuleTileProps) {
  const getBadgeClass = (type: StatusType) => {
    switch (type) {
      case "online":
        return "badge badge-online";
      case "warning":
        return "badge badge-warning";
      case "empty":
      case "muted":
      default:
        return "badge badge-muted";
    }
  };

  const getStatusDotClass = (type: StatusType) => {
    switch (type) {
      case "online":
        return "status-dot status-dot-online";
      case "warning":
        return "status-dot status-dot-warning";
      case "empty":
      case "muted":
      default:
        return "status-dot status-dot-muted";
    }
  };

  const getColSpanClass = (span: number) => {
    switch (span) {
      case 12:
        return styles.colSpan12;
      case 8:
        return styles.colSpan8;
      case 4:
        return styles.colSpan4;
      case 6:
      default:
        return styles.colSpan6;
    }
  };

  return (
    <div
      className={`${styles.tile} ${isPlaceholder ? styles.tilePlaceholder : ""} ${getColSpanClass(
        colSpan
      )}`}
    >
      <div className={styles.tileHeader}>
        <div className={styles.tileTitleGroup}>
          <h2 className={styles.tileTitle}>{title}</h2>
        </div>
        {status && (
          <span className={getBadgeClass(statusType)}>
            <span className={getStatusDotClass(statusType)} />
            {status}
          </span>
        )}
      </div>

      <div className={styles.tileBody}>{children}</div>

      {(destination || footerNote) && (
        <div className={styles.tileFooter}>
          <span className={styles.footerNote}>{footerNote || "MODULE READY"}</span>
          {destination && (
            <Link href={destination} className="system-btn system-btn-primary">
              {actionLabel} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
