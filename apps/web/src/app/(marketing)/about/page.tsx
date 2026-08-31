import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description: "Who builds Tantu, and why it starts with the saree.",
};

const PRINCIPLES = [
  {
    title: "The motif is the product",
    body: "On a hand-painted saree, the pattern is not decoration on top of the garment — it is the thing being sold. Any tool that redraws it has failed, however good the picture looks.",
  },
  {
    title: "Nothing is deleted on your behalf",
    body: "Renders are kept so a design can be found again, re-run and compared. Deleting them is your decision, not a privacy policy's.",
  },
  {
    title: "Say what it cannot do",
    body: "Every tool page carries its own limitation, and anything unbuilt is marked unbuilt. It is a slower way to sell and a much faster way to keep a buyer.",
  },
  {
    title: "Show the working",
    body: "The exact prompt behind every render is visible and editable. If a result is good you should be able to see why, and repeat it.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16">
      <p className="label mb-3">About Us</p>
      <h1 className="display max-w-3xl text-[38px] leading-tight sm:text-[48px]">
        Built on a working floor, not in a demo.
      </h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-5 text-[17px] leading-relaxed text-ink-soft">
          <p>
            Tantu is made by <strong className="text-ink">VVIS Tech</strong>. It grew out of an
            inventory and production system we build for a kalamkari manufacturer — a business where
            every design exists in a dozen colourways, where staff photograph stock on a phone in a
            warehouse, and where a returned parcel is somebody&apos;s afternoon.
          </p>
          <p>
            That is where the idea came from. The photographs already existed, already labelled by
            part, because someone on the floor had to take them anyway. The gap was between having
            good photographs of cloth and having something a buyer would look at.
          </p>
          <p>
            Generic try-on tools are built for Western tops and dresses. They handle a shirt well
            and a five-and-a-half-metre drape badly, because a saree is not a garment you put on a
            body — it is a length of cloth pleated, tucked and thrown in a specific order. Tantu
            starts from that, and from the assumption that the print must survive it.
          </p>
          <p className="text-ink">
            It is a product in its own right. It serves the manufacturer it was born in, and it is
            built so it can serve anyone else without carrying their system along with it.
          </p>
        </div>

        <div className="space-y-4">
          {PRINCIPLES.map((principle) => (
            <div key={principle.title} className="rounded-2xl border border-line bg-surface p-6">
              <h2 className="text-[16px] font-medium">{principle.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{principle.body}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-20 rounded-3xl border border-line bg-surface p-8 sm:p-12">
        <h2 className="display text-[28px]">Where the name comes from</h2>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-soft">
          <em>Tantu</em> is Sanskrit for thread — the single strand that everything woven is made
          from. It seemed like the right name for a tool whose whole argument is that the thread has
          to survive the process.
        </p>
      </section>
    </div>
  );
}
