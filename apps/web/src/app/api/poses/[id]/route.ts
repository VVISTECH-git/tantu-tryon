import { poseSpec } from "@/registry/poses";

export const runtime = "nodejs";

/**
 * The full specification behind a pose id.
 *
 * This is the retrieval half of the architecture: the Studio records
 * `SAR-P15`, and everything downstream — the generation orchestrator, QC, an
 * admin view — resolves that id here rather than being handed pose behaviour
 * by the UI.
 *
 * Any status is returned. Status governs what a customer may *choose*, not
 * what the backend may look up: a job recorded months ago must still resolve
 * even if its pose has since been deprecated.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const record = poseSpec(id);

  if (!record) {
    return Response.json({ error: `No pose ${id} in the registry.` }, { status: 404 });
  }

  return Response.json(record, {
    headers: { "Cache-Control": "no-store" },
  });
}
