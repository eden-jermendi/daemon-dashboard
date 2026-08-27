"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please provide an email and a password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name: name.trim() || "Owner",
      });

      if (result.error) {
        if (
          result.error.message?.toLowerCase().includes("disabled") ||
          result.error.code === "SIGN_UP_DISABLED"
        ) {
          setErrorMessage(
            "Account registration is disabled for this instance. Only existing accounts may sign in."
          );
        } else {
          setErrorMessage(result.error.message || "Registration failed. Please check your details.");
        }
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during account creation.";
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
          <span className="badge badge-online">
            <span className="status-dot status-dot-online" />
            ONBOARDING
          </span>
        </div>

        <div className={styles.panelBody}>
          <div className={styles.statusNotice}>
            <div className={styles.statusNoticeHeader}>INITIAL OWNER BOOTSTRAP</div>
            <p className={styles.statusNoticeText}>
              Create the primary dashboard owner account. After registration,
              disable sign-ups in your Neon project settings to lock access.
            </p>
          </div>

          {errorMessage && (
            <div className={styles.errorBanner}>{errorMessage}</div>
          )}

          <form onSubmit={handleSignUp} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="name" className={styles.label}>
                NAME / IDENTIFIER (OPTIONAL)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Owner"
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>
                OWNER EMAIL
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@daemon.local"
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
                autoComplete="new-password"
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
              {isLoading ? "CREATING ACCOUNT..." : "CREATE OWNER ACCOUNT →"}
            </button>
          </form>

          <div className={styles.actionLinks}>
            <Link href="/auth/sign-in" className={styles.link}>
              ← Return to Sign In
            </Link>
          </div>
        </div>

        <div className={styles.panelFooter}>
          <span>NEON AUTH : BOOTSTRAP</span>
          <span>SINGLE-USER</span>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
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
                LOADING ONBOARDING...
              </div>
            </div>
          </div>
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
