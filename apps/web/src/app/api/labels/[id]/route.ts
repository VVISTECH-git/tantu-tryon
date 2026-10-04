import { canReviewLabels, setVerdict, VERDICTS, type Verdict } from "@/lib/partLabels";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/** Staff verdict on one marked photo: approved, wrong (with a note), or back to pending. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount();
    if (!canReviewLabels(account)) throw new Forbidden();
    const { id } = await params;
    const { status, note } = (await request.json().catch(() => ({}))) as { status?: string; note?: string };
    if (!VERDICTS.includes(status as Verdict)) return Response.json({ error: "Choose approved or wrong." }, { status: 400 });
    const text = note?.trim().slice(0, 1000) || null;
    if (status === "wrong" && !text) return Response.json({ error: "Write what is wrong." }, { status: 400 });
    const row = await setVerdict(id, status as Verdict, status === "approved" ? null : text, account.username ?? account.name);
    if (!row) return Response.json({ error: "That photo is gone." }, { status: 404 });
    return Response.json({ status: row.status, note: row.note, reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not save." }, { status: 500 });
  }
}
