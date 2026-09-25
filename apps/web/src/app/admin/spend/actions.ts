"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/session";
import { setImageOption } from "@/lib/imageModels";
import { grantCredits, setSetting } from "@/lib/spend";

/** Server Actions carry no cookie check of their own, so each one asks for the account first. */

export async function togglePauseAction(form: FormData) {
  await requireAccount();
  await setSetting("generation_paused", form.get("paused") === "true" ? "true" : "false");
  revalidatePath("/admin/spend");
}

export async function setCapsAction(form: FormData) {
  await requireAccount();
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
  await requireAccount();
  await setImageOption(String(form.get("option") ?? ""));
  revalidatePath("/admin/spend");
}

export async function grantAction(form: FormData) {
  const account = await requireAccount();
  const rupees = Number(form.get("rupees"));
  if (Number.isFinite(rupees) && rupees > 0) {
    await grantCredits(account.id, Math.round(rupees * 100), "admin grant");
  }
  revalidatePath("/admin/spend");
}
