import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What the Tantu app and website collect, why, who processes it, and how to have it deleted.",
};

const CONTACT = "admin@vvistech.com";
const UPDATED = "2 October 2026";

/**
 * Tantu's privacy policy (2 Oct 2026, for the App Store listing). Written to
 * match what the app actually does: if the app changes what it collects or
 * who processes it, this page changes with it.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="label mb-3">Privacy Policy</p>
      <h1 className="display text-[36px] leading-tight sm:text-[44px]">What Tantu keeps, and why</h1>
      <p className="mt-3 text-[14px] text-ink-faint">Last updated {UPDATED}</p>

      <div className="mt-10 space-y-8 text-[16px] leading-relaxed text-ink-soft">
        <section>
          <p>
            Tantu is a product of <strong className="text-ink">VVIS Technologies (OPC) Private Limited</strong> (&ldquo;VVIS Tech&rdquo;,
            &ldquo;we&rdquo;), India. Tantu is a tool for clothing businesses: staff photograph garments in the Tantu app or on this
            website, and Tantu makes catalogue images of a model wearing them. Accounts are created by a business for its own staff;
            there is no public sign-up in the app.
          </p>
        </section>

        <section>
          <h2 className="text-[20px] font-semibold text-ink">What we collect</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-ink">Account details</strong>: the username and display name your business gave you, your role, and
              your password, which we store only in hashed form.
            </li>
            <li>
              <strong className="text-ink">Garment photographs</strong> you take or upload, the product IDs you enter or that are given
              automatically, which login took each photo and when, and the automatic quality check of each photo.
            </li>
            <li>
              <strong className="text-ink">Generated images</strong> and the inputs used to make them (the photo sheet and the
              instructions sent to the image model), with their cost to your business.
            </li>
            <li>
              <strong className="text-ink">A random device identifier</strong> created by the app, used only so that a product number
              held on one phone is not given to another.
            </li>
            <li>
              <strong className="text-ink">Technical logs</strong> kept by our hosting provider (such as request times and errors), used to
              keep the service running.
            </li>
          </ul>
          <p className="mt-3">
            We do not collect your location, contacts or advertising identifiers, we show no advertising, and we do not sell or share
            personal data for advertising.
          </p>
        </section>

        <section>
          <h2 className="text-[20px] font-semibold text-ink">Phone permissions</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li><strong className="text-ink">Camera</strong>: to photograph garments and to read product tags.</li>
            <li><strong className="text-ink">Photos</strong>: to pick a garment photo you already have, and to save finished images when you choose to.</li>
            <li><strong className="text-ink">Motion sensor</strong>: to tell you when the phone is held straight and still for a sharp photo. It stays on the phone.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[20px] font-semibold text-ink">How it is used</h2>
          <p className="mt-3">
            Only to run Tantu for your business: to store your garment photos, make the images you ask for, show your team its products
            and images, and keep spending within the limits your business sets. Your photos are not used to train AI models without
            your business&apos;s written permission.
          </p>
        </section>

        <section>
          <h2 className="text-[20px] font-semibold text-ink">Who processes it for us</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li><strong className="text-ink">Vercel</strong>: hosts the website and the app&apos;s server.</li>
            <li><strong className="text-ink">Neon</strong>: the database holding accounts, products and records.</li>
            <li><strong className="text-ink">Cloudflare R2</strong>: stores photos and generated images.</li>
            <li>
              <strong className="text-ink">Google (Gemini API)</strong>, and where your business chooses it, <strong className="text-ink">OpenRouter</strong>:
              receive the garment photos and instructions needed to make each image you ask for.
            </li>
            <li><strong className="text-ink">Expo</strong>: delivers updates to the app.</li>
          </ul>
          <p className="mt-3">These providers may process data outside India.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-semibold text-ink">How long we keep it, and deletion</h2>
          <p className="mt-3">
            Data is kept while your business uses Tantu. A business owner can delete products and their photos in the app or on the
            website at any time. To delete your login or all of your business&apos;s data, write to{" "}
            <span className="font-medium text-ink">{CONTACT}</span> from your business&apos;s registered email; we delete it within 30
            days, except records the law requires us to keep.
          </p>
        </section>

        <section>
          <h2 className="text-[20px] font-semibold text-ink">Children</h2>
          <p className="mt-3">Tantu is a business tool and is not meant for children under 18.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-semibold text-ink">Contact</h2>
          <p className="mt-3">
            Questions about this policy or your data: <span className="font-medium text-ink">{CONTACT}</span>. If this policy changes,
            the date at the top changes too.
          </p>
        </section>
      </div>
    </div>
  );
}
