"use server";

import { revalidatePath } from "next/cache";
import { ROLES, requireRole, upsertUser, type Role } from "@/lib/session";

/** Add a person to this shop, or change their password and role. Owners only. */
export async function saveUserAction(form: FormData) {
  const shop = await requireRole("owner");
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const role = String(form.get("role") ?? "") as Role;
  if (!/^[a-z0-9._-]{3,32}$/.test(username) || password.length < 6 || !ROLES.includes(role)) return;
  await upsertUser(shop.id, username, password, role);
  revalidatePath("/admin/shop");
}
