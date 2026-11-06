import { requirePage } from "@/lib/page-auth";
import { productRows } from "@/lib/productInputs";
import { PhotoWall } from "./PhotoWall";

export const dynamic = "force-dynamic";

/**
 * The whole website since 6 Nov 2026: each product's ID and its photos,
 * newest first. Platform admin only; anyone else signed in is told so here
 * (a redirect would bounce between this page and sign-in).
 */
export default async function PhotosPage() {
  const account = await requirePage("/admin/photos");
  if (!account.platformAdmin) {
    return <main className="mx-auto max-w-5xl px-6 py-8 text-ink-soft">This page is for the admin login. Sign out and sign in as admin.</main>;
  }
  const rows = await productRows();
  const items = rows.map((r) => ({ id: r.id, code: r.productCode ?? "No product ID", photos: r.photos }));
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <PhotoWall items={items} />
    </main>
  );
}
