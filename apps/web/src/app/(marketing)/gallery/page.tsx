import Link from "next/link";
import type { Metadata } from "next";
import { ImageSlot } from "@/components/site/art/Ornament";
import { GALLERY } from "@/content/gallery";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Renders this engine actually produced, from garments we actually have.",
};

export default function GalleryPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16">
      <p className="label mb-3">Gallery</p>
      <h1 className="display max-w-3xl text-[38px] leading-tight sm:text-[46px]">
        Real renders, from real cloth.
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
        Everything on this page is an image this engine produced from a garment we have in hand,
        shown next to the fabric it was rendered from. Nothing here is stock photography and nothing
        is borrowed.
      </p>

      {GALLERY.length === 0 ? (
        <>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(["madder", "indigo", "turmeric", "cream"] as const).map((tone, index) => (
              <div key={tone} className="overflow-hidden rounded-2xl">
                <ImageSlot tone={tone} seed={index} vine={index % 2 === 0} ratio={4 / 5} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-ink-faint">
            Drawn block-print fields, not renders. They are here so the page has something to look
            at, and they will be replaced rather than added to.
          </p>

          <div className="mt-10 rounded-3xl border border-dashed border-line bg-surface p-10 sm:p-14">
            <h2 className="display text-[24px]">Empty, on purpose.</h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-soft">
            The first real renders go in here once they exist. It would take ten minutes to fill this
            page with impressive-looking pictures from somewhere else, and it would be the single
            most misleading thing on the site — a gallery is a promise about what your fabric will
            look like when you send it.
          </p>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-soft">
            Until then, the honest thing to do is to put a saree through it yourself.
          </p>
            <Link
              href="/studio"
              className="mt-7 inline-block rounded-full bg-accent px-6 py-3 text-[15px] font-medium text-white transition hover:bg-accent-hover"
            >
              Open the Studio →
            </Link>
          </div>
        </>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY.map((item) => (
            <figure
              key={item.src}
              className="overflow-hidden rounded-2xl border border-line bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.alt} className="aspect-4/5 w-full object-cover" />
              <figcaption className="flex items-baseline gap-3 px-5 py-4">
                <span className="text-[15px] font-medium">{item.design}</span>
                <span className="label ml-auto">{item.pose}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
