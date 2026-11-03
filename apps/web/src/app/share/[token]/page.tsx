import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { productRows } from "@/lib/productInputs";
import { isShareToken } from "@/lib/share";
import { PhotoWall } from "../../admin/photos/PhotoWall";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products", robots: { index: false, follow: false } };

/**
 * The shared page (3 Nov): each product's ID and its photos, for people
 * outside, by link only. Tag photos are left out; products with no other
 * photo are not listed.
 */
export default async function SharedPhotos({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await isShareToken(token))) notFound();
  const rows = await productRows();
  const items = rows
    .map((r) => ({ id: r.id, code: r.productCode ?? "No product ID", photos: r.photos.filter((p) => p.slot !== "tag") }))
    .filter((it) => it.photos.length > 0);
  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-[24px] font-semibold tracking-tight">Products</h1>
      <PhotoWall items={items} />
    </main>
  );
}
