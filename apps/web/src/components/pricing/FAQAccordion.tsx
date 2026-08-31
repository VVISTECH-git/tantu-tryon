"use client";

import { useId, useState } from "react";

export interface AccordionItem {
  q: string;
  a: string;
}

/**
 * Accessible disclosure list.
 *
 * A real button per row carrying aria-expanded and aria-controls, and a region
 * labelled by that button. The open transition animates grid-template-rows,
 * which is the one way to ease from nothing to auto height without measuring;
 * the reduced-motion rule in globals.css switches it off for anyone who asked.
 */
export function FAQAccordion({ items }: { items: AccordionItem[] }) {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, index) => {
        const expanded = open === index;
        const buttonId = `${baseId}-q-${index}`;
        const panelId = `${baseId}-a-${index}`;

        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : index)}
                className="flex w-full items-start gap-6 py-6 text-left transition-colors duration-200 hover:text-madder"
              >
                <span className="flex-1 text-[17px] font-medium leading-snug">{item.q}</span>
                <span
                  aria-hidden
                  className={`mt-1 shrink-0 text-[18px] leading-none text-ink-faint transition-transform duration-200 ${
                    expanded ? "rotate-45" : ""
                  }`}
                >
                  +
                </span>
              </button>
            </h3>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              // `hidden` would be display:none and kill the transition; `inert`
              // takes the collapsed answer out of focus order and the
              // accessibility tree while leaving it animatable.
              inert={!expanded}
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl pb-7 text-[15.5px] leading-relaxed text-ink-soft">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
