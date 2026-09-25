import { IMAGE_OPTIONS, setImageOption } from "@/lib/imageModels";
import { requirePlatform, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/** Choose the image model every everyday generation uses. Platform admin only. */
export async function POST(request: Request) {
  try {
    await requirePlatform();
    const { option } = (await request.json().catch(() => ({}))) as { option?: string };
    if (!IMAGE_OPTIONS.some((o) => o.id === option && o.selectable)) {
      return Response.json({ error: "That model cannot be chosen." }, { status: 400 });
    }
    await setImageOption(option!);
    return Response.json({ ok: true, chosen: option });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not save the model." }, { status: 500 });
  }
}
