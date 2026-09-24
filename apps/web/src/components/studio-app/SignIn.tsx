"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** The door, in the shell's own clothes. Username, password, one button. */
export function SignIn({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not sign in.");
      router.push(next);
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="st">
      <div className="st-shell">
        <header className="st-header">
          <div className="st-header-main" />
          <div className="st-header-center">
            <div className="st-brand">
              <span className="st-brand-mark">Tantu</span>
              <small>Try-On</small>
            </div>
          </div>
          <div className="st-header-actions" />
        </header>
        <main className="st-main" style={{ alignContent: "center" }}>
          <div className="st-center" style={{ gap: 30, paddingTop: 20 }}>
            <div>
              <h1 className="st-title st-title--hero">Your AI Fashion Shoot Studio</h1>
              <p className="st-copy" style={{ marginTop: 10, maxWidth: 300 }}>
                Sign in to begin.
              </p>
            </div>
            <form onSubmit={submit} className="st-stack" style={{ width: "100%", maxWidth: 300 }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                className="st-input"
                style={{ minHeight: 48, textAlign: "center", fontSize: 16 }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="st-input"
                style={{ minHeight: 48, textAlign: "center", fontSize: 16 }}
              />
              {error && <p className="st-error">{error}</p>}
              <button type="submit" className="st-action" disabled={busy || !username || !password}>
                {busy ? "Please wait..." : "Sign in"}
              </button>
            </form>
          </div>
        </main>
        <footer className="st-footer" />
      </div>
    </div>
  );
}
