"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setErrorMessage(result.error.message || "Authentication failed. Check credentials.");
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected authentication error occurred.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.authPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.headerTitle}>DAEMON DASHBOARD</span>
          <span className="badge badge-warning">
            <span className="status-dot status-dot-warning" />
            RESTRICTED
          </span>
        </div>

        <div className={styles.panelBody}>
          <div className={styles.statusNotice}>
            <div className={styles.statusNoticeHeader}>ACCESS: RESTRICTED</div>
            <p className={styles.statusNoticeText}>
              Authentication required. Single-user access boundary managed via Neon Auth.
            </p>
          </div>

          {errorMessage && (
            <div className={styles.errorBanner}>{errorMessage}</div>
          )}

          <form onSubmit={handleSignIn} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>
                USER / EMAIL
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@daemon.local"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                PASSWORD
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={styles.input}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={styles.submitBtn}
            >
              {isLoading ? "AUTHENTICATING..." : "AUTHENTICATE →"}
            </button>
          </form>
        </div>

        <div className={styles.panelFooter}>
          <span>NEON AUTH : MANAGED BETTER AUTH</span>
          <span>MILESTONE 2A</span>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.authPanel}>
            <div className={styles.panelHeader}>
              <span className={styles.headerTitle}>DAEMON DASHBOARD</span>
            </div>
            <div className={styles.panelBody}>
              <div className="mono" style={{ color: "var(--text-muted)" }}>
                LOADING ACCESS CONTROL...
              </div>
            </div>
          </div>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
