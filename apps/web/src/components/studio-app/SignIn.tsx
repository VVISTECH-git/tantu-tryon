"use client";
/* eslint-disable @next/next/no-img-element -- three small splash photographs at their own size */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TantuMark } from "./TantuMark";

/**
 * The door: the splash's mark and three of its photographs, then one card
 * with a username, a password that can be shown, and the orange button.
 */
export function SignIn({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        body: JSON.stringify({ username: username.trim(), password }),
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
      <div className="st-shell st-shell--signin">
        <main className="st-signin">
          <div className="st-signin-brand">
            <TantuMark className="st-signin-mark" />
            <h1 className="st-signin-name">Tantu</h1>
            <p className="st-signin-tagline">AI Studio for Fashion Brands</p>
          </div>

          <div className="st-signin-fan" aria-hidden>
            <img src="/splash/b_1.jpg" alt="" />
            <img src="/splash/b_3.jpg" alt="" />
            <img src="/splash/b_5.jpg" alt="" />
          </div>

          <form onSubmit={submit} className="st-signin-card">
            <h2 className="st-signin-title">Sign in to your studio</h2>
            <label className="st-field">
              <span>Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                className="st-field-input"
              />
            </label>
            <label className="st-field">
              <span>Password</span>
              <div className="st-field-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="st-field-input"
                />
                <button type="button" className="st-field-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            {error && (
              <p className="st-signin-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="st-action" disabled={busy || !username.trim() || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
