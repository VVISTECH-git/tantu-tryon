"use server";

import { revalidatePath } from "next/cache";
import { createShop, requirePlatform } from "@/lib/session";
import { setImageOption } from "@/lib/imageModels";
import { grantCredits, setSetting } from "@/lib/spend";

/**
 * The platform's switches: only Tantu's own admin. Server Actions carry no
 * cookie check of their own, so each one asks for the login first.
 */

export async function togglePauseAction(form: FormData) {
  await requirePlatform();
  await setSetting("generation_paused", form.get("paused") === "true" ? "true" : "false");
  revalidatePath("/admin/spend");
}

export async function setCapsAction(form: FormData) {
  await requirePlatform();
  const paise = (name: string) => {
    const n = Number(form.get(name));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  };
  const daily = paise("daily");
  const monthly = paise("monthly");
  if (daily) await setSetting("spend_cap_daily_paise", String(daily));
  if (monthly) await setSetting("spend_cap_monthly_paise", String(monthly));
  revalidatePath("/admin/spend");
}

export async function setImageModelAction(form: FormData) {
  await requirePlatform();
  await setImageOption(String(form.get("option") ?? ""));
  revalidatePath("/admin/spend");
}

/** Credit for one shop, chosen on the page. */
export async function grantAction(form: FormData) {
  await requirePlatform();
  const shopId = String(form.get("shop") ?? "");
  const rupees = Number(form.get("rupees"));
  if (shopId && Number.isFinite(rupees) && rupees > 0) {
    await grantCredits(shopId, Math.round(rupees * 100), "platform grant");
  }
  revalidatePath("/admin/spend");
}

/** A new customer shop, with its owner's login and starting credit. */
export async function createShopAction(form: FormData) {
  await requirePlatform();
  const name = String(form.get("name") ?? "").trim();
  const owner = String(form.get("owner") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const starting = Math.max(0, Number(form.get("starting")) || 0);
  if (!name || !/^[a-z0-9._-]{3,32}$/.test(owner) || password.length < 6) return;
  await createShop(name, owner, password, Math.round(starting * 100));
  revalidatePath("/admin/spend");
}

