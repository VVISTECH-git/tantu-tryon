"use server";

import { revalidatePath } from "next/cache";
import { requirePlatform } from "@/lib/session";
import { deleteUnused } from "@/lib/storageUsage";

/** The Storage page's "Delete them": platform admin only. */
export async function deleteUnusedAction(): Promise<void> {
  await requirePlatform();
  await deleteUnused();
  revalidatePath("/admin/storage");
}
