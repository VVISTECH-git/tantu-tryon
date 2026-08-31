"use client";

import { useMemo, useState } from "react";

/**
 * No backend yet, so this composes a message and hands it to the visitor's mail
 * client. A form that silently swallows enquiries is worse than no form.
 */

const CONTACT_EMAIL = "admin@tantu.ai";

const REASONS = [
  "Try it on my own fabric",
  "Pricing for a catalogue",
  "API or integration",
  "Something else",
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState(REASONS[0]!);
  const [message, setMessage] = useState("");

  const mailto = useMemo(() => {
    const subject = `Tantu — ${reason}`;
    const body = [
      `Name: ${name || "—"}`,
      `Business: ${company || "—"}`,
      `Reply to: ${email || "—"}`,
      `About: ${reason}`,
      "",
      message,
    ].join("\n");
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [name, company, email, reason, message]);

  const ready = name.trim() !== "" && email.trim() !== "" && message.trim() !== "";

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <p className="label mb-3">Contact Us</p>
          <h1 className="display text-[38px] leading-tight sm:text-[46px]">
            Send us a saree and a question.
          </h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-soft">
            The fastest way to find out whether this works for your cloth is to put your cloth
            through it. If you would rather we ran the first one for you, say so — that is usually
            the quickest way to a straight answer.
          </p>

          <dl className="mt-10 space-y-6">
            <div>
              <dt className="label">Email</dt>
              <dd className="mt-1">
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-[17px] text-accent hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </dd>
            </div>
            <div>
              <dt className="label">Who you are writing to</dt>
              <dd className="mt-1 text-[16px] leading-relaxed text-ink-soft">
                VVIS Tech — the people who build it. Not a support queue.
              </dd>
            </div>
            <div>
              <dt className="label">What we will not do</dt>
              <dd className="mt-1 text-[16px] leading-relaxed text-ink-soft">
                Put you on a mailing list, or use the photographs you send for anything other than
                answering you.
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-7 sm:p-9">
          <div className="space-y-4">
            <Field label="Your name" value={name} onChange={setName} placeholder="Bhanu" />
            <Field
              label="Business"
              value={company}
              onChange={setCompany}
              placeholder="Sree Lakshmi Kalamkari"
            />
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
            />

            <div>
              <span className="label mb-2 block">What about?</span>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={reason === option}
                    onClick={() => setReason(option)}
                    className={`rounded-full border px-3.5 py-1.5 text-[14px] transition ${
                      reason === option
                        ? "border-accent bg-accent text-white"
                        : "border-line text-ink-soft hover:border-ink-faint hover:text-ink"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label mb-1.5 block">Message</span>
              <textarea
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="What are you making, and how many designs a month?"
                className="w-full resize-y rounded-xl border border-line bg-ground px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition placeholder:text-ink-faint focus:border-accent"
              />
            </div>

            <a
              href={ready ? mailto : undefined}
              aria-disabled={!ready}
              className={`block rounded-full px-5 py-3.5 text-center text-[16px] font-medium transition ${
                ready
                  ? "bg-accent text-white hover:bg-accent-hover"
                  : "pointer-events-none bg-surface-3 text-ink-soft"
              }`}
            >
              Write the email
            </a>
            <p className="text-center text-[13px] leading-relaxed text-ink-faint">
              This opens your own mail app with the message filled in. Nothing is sent from this page
              and nothing is stored here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-line bg-ground px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-ink-faint focus:border-accent"
      />
    </label>
  );
}
