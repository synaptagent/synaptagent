import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/ensure-user";
import { runTaskPipeline } from "@/lib/agent/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live, streamed agent run triggered from chat (owner only). Same pipeline as
// the synchronous executeAgentRun (runTaskPipeline), but it emits NDJSON events
// as it goes so the chat can show the agent working in real time. The result is
// saved as a Task, which is exactly what shows up on the activity feed.
//
// Events (one JSON object per line):
//   { t: "phase", label }   a phase started (planning | researching | working | finalizing)
//   { t: "delta", v }       a token of the final deliverable (finalizing phase)
//   { t: "done", taskId, summary }
//   { t: "error" }
export async function POST(req: Request) {
  const user = await ensureUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  let body: { agentRef?: string; focus?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const ref = typeof body.agentRef === "string" ? body.agentRef : "";
  if (!ref.includes("/")) return new Response("bad request", { status: 400 });
  const slash = ref.indexOf("/");
  const handle = ref.slice(0, slash);
  const name = ref.slice(slash + 1);

  const agent = await prisma.agent.findFirst({
    where: { owner: { username: handle }, name },
    select: { id: true, ownerId: true, personality: true, description: true },
  });
  if (!agent) return new Response("not found", { status: 404 });
  if (agent.ownerId !== user.id) return new Response("forbidden", { status: 403 });

  const task = await prisma.task.create({
    data: {
      agentId: agent.id,
      userId: user.id,
      prompt: body.focus?.trim() || agent.description || "",
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  const encoder = new TextEncoder();

  // Status-guarded: only ever flips a still-RUNNING task to a terminal state, so
  // it can never overwrite a row that already reached COMPLETED.
  const markFailed = (result: string) =>
    prisma.task
      .updateMany({
        where: { id: task.id, status: "RUNNING" },
        data: { status: "FAILED", result, completedAt: new Date() },
      })
      .catch(() => {});

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Swallow enqueue errors: a client that already disconnected must NOT turn
      // a finished run into a failure. The run still completes + saves server-side.
      const send = (ev: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        } catch {
          // consumer gone
        }
      };

      let streamed = "";
      try {
        const { final, summary } = await runTaskPipeline(
          task.id,
          agent.id,
          agent,
          {
            onPhase: (label) => send({ t: "phase", label }),
            onDelta: (v) => {
              streamed += v;
              send({ t: "delta", v });
            },
          },
          typeof body.focus === "string" ? body.focus : undefined,
        );
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: "COMPLETED",
            result: final,
            summary,
            completedAt: new Date(),
          },
        });
        send({ t: "done", taskId: task.id, summary: summary ?? null });
      } catch {
        // keep any deliverable we already streamed; never clobber a COMPLETED row
        await markFailed(streamed.trim() || "the run hit an error. try again in a moment.");
        send({ t: "error" });
      } finally {
        controller.close();
      }
    },
    // client disconnected / cancelled: flip a still-running task to a terminal
    // state so it never sits orphaned in RUNNING forever.
    async cancel() {
      await markFailed("the run was interrupted.");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
