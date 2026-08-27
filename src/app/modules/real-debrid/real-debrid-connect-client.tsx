"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

interface DeviceAuthData {
  user_code: string;
  interval: number;
  expires_in: number;
  verification_url: string;
}

type FlowState = "idle" | "requesting" | "authorizing" | "expired" | "error";

export function RealDebridConnectClient() {
  const router = useRouter();
  const [state, setState] = useState<FlowState>("idle");
  const [deviceData, setDeviceData] = useState<DeviceAuthData | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timers helper
  const clearTimers = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  const startConnect = async () => {
    clearTimers();
    setState("requesting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/integrations/real-debrid/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error("Failed to request device authorization code.");
      }

      const data: DeviceAuthData = await res.json();
      setDeviceData(data);
      setSecondsRemaining(data.expires_in);
      setState("authorizing");

      // Start countdown timer
      countdownTimerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearTimers();
            setState("expired");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start polling status
      const pollIntervalMs = Math.max((data.interval || 5) * 1000, 3000);
      pollTimerRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/integrations/real-debrid/connect/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (!statusRes.ok) return;

          const statusData = await statusRes.json();
          if (statusData.status === "connected") {
            clearTimers();
            router.refresh();
          } else if (statusData.status === "expired") {
            clearTimers();
            setState("expired");
          } else if (statusData.status === "error") {
            clearTimers();
            setErrorMessage(statusData.message || "Failed to exchange credentials.");
            setState("error");
          }
        } catch {
          // Ignore transient poll errors
        }
      }, pollIntervalMs);
    } catch (err) {
      clearTimers();
      setErrorMessage(err instanceof Error ? err.message : "Error initiating connection.");
      setState("error");
    }
  };

  const handleCancel = async () => {
    clearTimers();
    try {
      await fetch("/api/integrations/real-debrid/connect/cancel", {
        method: "POST",
      });
    } catch {
      // Ignore
    }
    setDeviceData(null);
    setState("idle");
  };

  const copyCode = async () => {
    if (!deviceData?.user_code) return;
    try {
      await navigator.clipboard.writeText(deviceData.user_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  if (state === "authorizing" && deviceData) {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const formattedTime = `${mins}:${secs.toString().padStart(2, "0")}`;

    return (
      <div className={styles.authCard}>
        <div className={styles.authCardHeader}>
          <span className="status-dot status-dot-warning" />
          <span>AUTHORIZATION REQUIRED</span>
        </div>

        <div className={styles.authSteps}>
          <div className={styles.authStep}>
            <span className={styles.stepNum}>1</span>
            <div className={styles.stepContent}>
              <span className={styles.stepText}>
                Open the official Real-Debrid device authorization page:
              </span>
              <a
                href={deviceData.verification_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`system-btn system-btn-primary ${styles.openAuthBtn}`}
              >
                OPEN REAL-DEBRID AUTHORIZATION PAGE ↗
              </a>
            </div>
          </div>

          <div className={styles.authStep}>
            <span className={styles.stepNum}>2</span>
            <div className={styles.stepContent}>
              <span className={styles.stepText}>
                Enter this authorization code when prompted:
              </span>
              <div className={styles.codeContainer}>
                <span className={styles.codeDisplay}>{deviceData.user_code}</span>
                <button
                  type="button"
                  onClick={copyCode}
                  className={`system-btn ${styles.copyBtn}`}
                >
                  {copied ? "✓ COPIED" : "COPY CODE"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.authFooter}>
          <div className={styles.waitingIndicator}>
            <span className={styles.pulseDot} />
            <span className="mono">WAITING FOR AUTHORIZATION...</span>
            <span className={styles.countdownText}>({formattedTime} remaining)</span>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            className={`system-btn ${styles.cancelBtn}`}
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  if (state === "expired" || state === "error") {
    return (
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          {state === "expired" ? "AUTHORIZATION EXPIRED" : "CONNECTION ERROR"}
        </div>
        <p className={styles.statusCardText}>
          {errorMessage ||
            "The Real-Debrid authorization code has expired. Please initiate a new connection."}
        </p>
        <div className={styles.statusActions}>
          <button
            type="button"
            onClick={startConnect}
            className="system-btn system-btn-primary"
          >
            TRY AGAIN
          </button>
          <button
            type="button"
            onClick={() => setState("idle")}
            className="system-btn"
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.statusCard}>
      <div className={styles.statusCardHeader}>STATUS: UNLINKED</div>
      <div className={styles.statusCardState}>NOT CONNECTED</div>
      <p className={styles.statusCardText}>
        No Real-Debrid provider credentials or active OAuth2 sessions are configured for this user.
        Connect your account via the official open-source device authorization workflow.
      </p>
      <div className={styles.statusActions}>
        <button
          type="button"
          onClick={startConnect}
          disabled={state === "requesting"}
          className="system-btn system-btn-primary"
        >
          {state === "requesting" ? "INITIATING OAUTH..." : "CONNECT REAL-DEBRID"}
        </button>
      </div>
    </div>
  );
}
