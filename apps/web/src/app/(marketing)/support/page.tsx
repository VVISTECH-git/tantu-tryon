import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description: "Help with the Tantu app: signing in, taking photos, product IDs and deleting data.",
};

const CONTACT = "admin@vvistech.com";

const QUESTIONS = [
  {
    q: "How do I get a login?",
    a: "Your business owner creates logins for staff on the Tantu website (Shop page). There is no public sign-up.",
  },
  {
    q: "I forgot my password.",
    a: "Ask your business owner to set a new one on the Shop page, or write to us.",
  },
  {
    q: "The app says “No internet”.",
    a: "Photos you take are kept on the phone and send by themselves when the connection is back. Keep the app open for a moment once you are online.",
  },
  {
    q: "A photo says “Too small” or “Blurred”.",
    a: "Retake it closer, with the phone held still. The camera tells you to step closer until the garment fills the frame.",
  },
  {
    q: "How do I delete a product or my data?",
    a: "A business owner can delete a product inside it, or by sliding it left in Saved products. To delete a login or all data, write to us.",
  },
];

/** The App Store's support page for Tantu (2 Oct 2026). */
export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="label mb-3">Support</p>
      <h1 className="display text-[36px] leading-tight sm:text-[44px]">Help with Tantu</h1>
      <p className="mt-4 text-[16px] text-ink-soft">
        Write to <span className="font-medium text-ink">{CONTACT}</span>; we reply within one working day (India time).
      </p>

      <div className="mt-10 divide-y divide-line border-y border-line">
        {QUESTIONS.map((item) => (
          <div key={item.q} className="py-5">
            <h2 className="text-[17px] font-semibold text-ink">{item.q}</h2>
            <p className="mt-1.5 text-[15.5px] leading-relaxed text-ink-soft">{item.a}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-[14px] text-ink-faint">
        See also our{" "}
        <Link href="/privacy" className="underline">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
