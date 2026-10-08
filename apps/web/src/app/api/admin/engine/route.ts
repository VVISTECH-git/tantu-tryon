import { IMAGE_OPTIONS, chosenImageOption, setImageOption } from "@/lib/imageModels";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Which engine makes everyday images (8 Oct): the same choice the admin's
 * Platform page offers, reachable by the laptop's scripts too. GET shows it,
 * POST `{ option }` sets it (an id from IMAGE_OPTIONS, e.g. "qwen-local").
 */
export async function GET() {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const chosen = await chosenImageOption();
    return Response.json({ option: chosen.id, options: IMAGE_OPTIONS.filter((o) => o.selectable).map((o) => ({ id: o.id, name: `${o.name} · ${o.detail}` })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not read the engine." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const body = (await request.json().catch(() => ({}))) as { option?: string };
    if (!IMAGE_OPTIONS.some((o) => o.id === body.option && o.selectable)) return Response.json({ error: "Unknown engine option." }, { status: 400 });
    await setImageOption(body.option!);
    return Response.json({ option: body.option }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not set the engine." }, { status: 500 });
  }
}
