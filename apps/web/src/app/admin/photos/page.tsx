import { requirePage } from "@/lib/page-auth";
import { productRows } from "@/lib/productInputs";
import { PhotoWall } from "./PhotoWall";

export const dynamic = "force-dynamic";

/** Just each product's ID and its photos, newest first (3 Nov). Platform admin only. */
export default async function PhotosPage() {
  await requirePage("/admin/photos", { platform: true });
  const rows = await productRows();
  const items = rows.map((r) => ({ id: r.id, code: r.productCode ?? "No product ID", photos: r.photos }));
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-[24px] font-semibold tracking-tight">Photos</h1>
      <PhotoWall items={items} />
    </main>
  );
}
