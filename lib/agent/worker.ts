import "server-only";
import { prisma } from "@/lib/db";
import { runTaskPipeline } from "./engine";

// In-process background worker (Fase 4). Runs inside the Next server (both `next
// dev` and `next start` are long-lived node processes), so no separate service
// is needed at this scale. Started once from instrumentation.ts. Each tick:
//   1. reaps RUNNING tasks stranded by a crash/restart (back to the queue)
//   2. fires due Schedules into the run queue (atomic per-schedule claim)
//   3. runs the next queued Task to completion (single-flighted, one at a time)
// Scheduling + reaping are NOT held under the run lock, so a long/stuck run can
// never block new schedules from queuing. The atomic claims + reaper keep it
// correct even if a second instance is ever added.

const STALE_MS = 15 * 60_000; // a RUNNING task older than this is presumed dead
let processing = false; // only the task-runner is single-flighted

function advance(cadence: string, from: Date): Date {
  const d = new Date(from);
  if (cadence === "hourly") d.setHours(d.getHours() + 1);
  else if (cadence === "weekly") d.setDate(d.getDate() + 7);
  else d.setDate(d.getDate() + 1); // daily (default)
  return d;
}

// Requeue tasks stuck in RUNNING by a crash/deploy so they retry instead of
// sitting stranded forever. STALE_MS is well above the longest legitimate run.
async function reapStale(): Promise<void> {
  await prisma.task.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: new Date(Date.now() - STALE_MS) },
    },
    data: { status: "PENDING", startedAt: null },
  });
}

async function fireSchedules(): Promise<void> {
  const now = new Date();
  const due = await prisma.schedule.findMany({
    where: { active: true, nextRunAt: { lte: now } },
    take: 20,
    select: {
      id: true,
      agentId: true,
      cadence: true,
      focus: true,
      nextRunAt: true,
      agent: { select: { ownerId: true, description: true } },
    },
  });

  let fired = 0;
  for (const s of due) {
    if (!s.agent) continue;

    // anchor the next run to the cadence grid (not "now"), collapsing any
    // missed-slot backlog into a single next run — so cadence never drifts.
    let base = s.nextRunAt;
    do {
      base = advance(s.cadence, base);
    } while (base <= now);

    // atomic claim: a conditional UPDATE on nextRunAt is a row-lock, so exactly
    // one tick/instance wins this due window (no duplicate fires).
    const claimed = await prisma.schedule.updateMany({
      where: { id: s.id, active: true, nextRunAt: { lte: now } },
      data: { lastRunAt: now, nextRunAt: base },
    });
    if (claimed.count === 0) continue;

    await prisma.task.create({
      data: {
        agentId: s.agentId,
        userId: s.agent.ownerId,
        prompt: s.focus || s.agent.description || "",
        focus: s.focus ?? null,
        status: "PENDING",
      },
    });
    fired++;
  }
  if (fired) console.log(`[synapt] fired ${fired} schedule(s)`);
}

async function processNext(): Promise<void> {
  const pending = await prisma.task.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, agentId: true, focus: true },
  });
  if (!pending) return;

  // atomic claim: only one worker/tick can flip PENDING -> RUNNING
  const claim = await prisma.task.updateMany({
    where: { id: pending.id, status: "PENDING" },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  if (claim.count === 0) return; // claimed elsewhere; try next tick
  console.log(`[synapt] running queued task ${pending.id}`);

  const agent = await prisma.agent.findUnique({
    where: { id: pending.agentId },
    select: { id: true, ownerId: true, personality: true, description: true },
  });
  if (!agent) {
    await prisma.task.update({
      where: { id: pending.id },
      data: { status: "FAILED", result: "agent no longer exists.", completedAt: new Date() },
    });
    return;
  }

  try {
    const { final, summary } = await runTaskPipeline(
      pending.id,
      agent.id,
      agent,
      {},
      pending.focus ?? undefined, // explicit intent, recorded at enqueue
    );
    await prisma.task.update({
      where: { id: pending.id },
      data: { status: "COMPLETED", result: final, summary, completedAt: new Date() },
    });
  } catch {
    await prisma.task.update({
      where: { id: pending.id },
      data: {
        status: "FAILED",
        result: "the run hit an error. it will run again on the next schedule.",
        completedAt: new Date(),
      },
    });
  }
}

export async function tick(): Promise<void> {
  // cheap DB ops every tick, NOT under the run lock (so a stuck run can't block
  // scheduling or recovery)
  try {
    await reapStale();
    await fireSchedules();
  } catch {
    // ignore; retry next tick
  }
  // the long part runs one task at a time
  if (processing) return;
  processing = true;
  try {
    await processNext();
  } catch {
    // never let the loop die
  } finally {
    processing = false;
  }
}

export function startWorker(): void {
  const g = globalThis as unknown as { __synaptWorker?: NodeJS.Timeout };
  if (g.__synaptWorker) return; // guard against double-start on HMR
  g.__synaptWorker = setInterval(() => {
    void tick();
  }, 30_000);
  console.log("[synapt] background worker started");
  void tick(); // run once on boot
}
