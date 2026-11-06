"use client";

/** Sign out, then back to the sign-in screen. */
export function SignOut() {
  return (
    <button
      type="button"
      className="text-ink-soft underline hover:text-ink"
      onClick={() => {
        void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
          window.location.href = "/app";
        });
      }}
    >
      Sign out
    </button>
  );
}
