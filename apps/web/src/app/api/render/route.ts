import { renderPoses, toRawBase64, validateRequest } from "@tantu/engine";
import type { ProviderId, Reference, RenderRequest } from "@tantu/engine";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Body extends Omit<RenderRequest, "references" | "person"> {
  references: Reference[];
  person?: Reference;
  provider?: ProviderId;
}

/** Accepts data URLs or raw base64 from the browser; the engine wants raw. */
function clean(ref: Reference): Reference {
  return { ...ref, data: toRawBase64(ref.data) };
}

/**
 * Streams newline-delimited JSON, one line per pose as it finishes.
 *
 * Five poses take the better part of a minute. Handing back a blank screen for
 * that whole time — which is what every tool in this market does — makes a
 * working render feel broken, and hides which pose was the one that failed.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }

  const request: RenderRequest = {
    garment: body.garment,
    mode: body.mode,
    references: (body.references ?? []).map(clean),
    person: body.person ? clean(body.person) : undefined,
    model: body.model,
    scene: body.scene,
    poses: body.poses ?? [],
    extraInstruction: body.extraInstruction,
    quality: body.quality,
    promptSource: body.promptSource,
  };

  const problems = validateRequest(request);
  if (problems.length) return Response.json({ error: problems.join(" ") }, { status: 400 });

  // When the browser presses Stop it drops the connection; that has to reach
  // the provider, or "Stop" means "stop watching the money leave".
  const aborter = new AbortController();
  req.signal.addEventListener("abort", () => aborter.abort(), { once: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        if (aborter.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        } catch {
          // The client is gone; the abort listener has already fired.
        }
      };

      send({ type: "start", poses: request.poses.length });
      try {
        const report = await renderPoses(request, {
          provider: body.provider,
          concurrency: 3,
          signal: aborter.signal,
          onOutcome: (outcome) => send({ type: "outcome", outcome }),
        });
        send({
          type: "done",
          succeeded: report.succeeded,
          failed: report.failed,
          ms: report.ms,
        });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "The render failed.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting.
        }
      }
    },
    cancel() {
      aborter.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
