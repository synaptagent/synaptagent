import "server-only";
import { prisma } from "@/lib/db";
import { getAIRouter, type AIRouter, type ChatMessage } from "@/lib/ai";
import { hasWebSearch, webSearch, type WebResult } from "./web-search";

// The agent loop. A run walks a short pipeline; each step is logged to the DB as
// a TaskStep so the agent page + activity feed show the real work:
//   planning -> [researching] -> working -> finalizing
// The "researching" phase only runs when a web-search key is configured; it
// pulls REAL current sources so each run reflects what's actually out there
// (instead of repeating static LLM memory) and can cite them.
//
// runTaskPipeline() is shared by BOTH entry points so they produce identical runs:
//   - executeAgentRun()  -> the synchronous page "run" button (no streaming)
//   - /api/run route      -> the live, streamed "run" from chat (onDelta wired)
export const RUN_STEPS = [
  {
    label: "planning",
    instruction:
      "Plan how you will accomplish your mission. Give a short, concrete plan of 3 to 5 steps. Output just the plan, nothing else.",
  },
  {
    label: "working",
    instruction:
      "Now carry out the mission and produce the full deliverable. This is the real output your operator wants. Use your knowledge; be specific and useful.",
  },
  {
    label: "finalizing",
    instruction:
      "Review and polish the deliverable above. Fix anything weak, tighten it, and output ONLY the final, finished version.",
  },
];

export function buildRunSystem(
  personality: string,
  description: string | null,
): string {
  return `${personality}\n\nYour specific mission: ${
    description ?? "do your job well"
  }\n\nYou are doing focused work for your operator right now, not chatting. Be concrete, specific, and useful. No em-dashes. Respond in English.`;
}

export function runStepMessages(
  system: string,
  instruction: string,
  prior: string,
): ChatMessage[] {
  return [
    { role: "system", content: system },
    {
      role: "user",
      content: prior ? `${instruction}\n\nWork so far:\n${prior}` : instruction,
    },
  ];
}

// The working instruction, augmented with real sources when research found any.
function workInstruction(block: string): string {
  if (!block) return RUN_STEPS[1].instruction;
  return `${RUN_STEPS[1].instruction}\n\nYou searched the web and found these REAL, current sources. Base your deliverable on them, cite inline as [1], [2], etc., and end with a "Sources" list (number + url). Do not invent sources beyond these. Sources:\n${block}`;
}

/** Derive a few queries from the goal/plan, search the web, return a numbered
 *  sources block to ground the deliverable. Empty string if search is off/fails. */
export async function gatherSources(
  router: AIRouter,
  goal: string,
  plan: string,
): Promise<{ block: string; count: number }> {
  if (!hasWebSearch()) return { block: "", count: 0 };

  let queries: string[] = [];
  try {
    const q = await router.run("chat", [
      {
        role: "system",
        content:
          "You generate web search queries. Output 1 to 3 concise queries, one per line, no numbering, no quotes. They should surface current, real, specific sources for the task.",
      },
      { role: "user", content: `Task: ${goal}\n\nPlan:\n${plan}\n\nQueries:` },
    ]);
    queries = q.content
      .split("\n")
      .map((s) => s.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    queries = [];
  }
  if (!queries.length) queries = [goal];

  const seen = new Set<string>();
  const results: WebResult[] = [];
  for (const query of queries) {
    const rs = await webSearch(query, 4);
    for (const r of rs) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      results.push(r);
    }
  }

  // Deep read: use the full page content (truncated), not just the snippet, so
  // the deliverable can synthesize real specifics (numbers, findings, quotes).
  const top = results.slice(0, 5);
  const block = top
    .map((r, i) => {
      const body = (r.raw || r.content).replace(/\s+/g, " ").trim().slice(0, 2000);
      return `[${i + 1}] ${r.title}\n${r.url}\n${body}`;
    })
    .join("\n\n");
  return { block, count: top.length };
}

/** A one-line "tweet" of what a run produced, for the feed card. Null on failure. */
export async function summarizeRun(
  router: AIRouter,
  final: string,
): Promise<string | null> {
  try {
    const res = await router.run("chat", [
      {
        role: "system",
        content:
          "You write one-line summaries of work output for a social feed. Max 140 characters, one plain sentence, no hashtags, no quotes, no emojis. Say concretely what was produced.",
      },
      {
        role: "user",
        content: `Summarize this deliverable in one line (max 140 chars):\n\n${final.slice(0, 2000)}`,
      },
    ]);
    return res.content.replace(/\s+/g, " ").trim().slice(0, 180) || null;
  } catch {
    return null;
  }
}

/** Pull a few durable learnings from a finished deliverable, to remember for
 *  future runs on the same mission. Best-effort; returns [] on failure. */
export async function extractMemories(
  router: AIRouter,
  final: string,
): Promise<string[]> {
  try {
    const res = await router.run("chat", [
      {
        role: "system",
        content:
          "Extract 2 to 4 durable facts or insights from this work that are worth remembering for FUTURE runs on the same mission. One per line, specific and self-contained, no numbering, no fluff. Skip anything trivial or one-off.",
      },
      { role: "user", content: final.slice(0, 3000) },
    ]);
    return res.content
      .split("\n")
      .map((s) => s.replace(/^[-*\d.\s]+/, "").trim())
      .filter((s) => s.length > 8)
      .slice(0, 4);
  } catch {
    return [];
  }
}

export type RunCallbacks = {
  onPhase?: (label: string) => void;
  onDelta?: (v: string) => void;
};

/** Runs the full pipeline for an EXISTING task: logs each step, returns the
 *  final deliverable + summary. Shared by the sync page run and the streamed
 *  chat run. Pass onDelta to stream the finalizing phase token by token. */
export async function runTaskPipeline(
  taskId: string,
  agentId: string,
  agent: { personality: string; description: string | null },
  cb: RunCallbacks = {},
  focus?: string,
): Promise<{ final: string; summary: string | null }> {
  const router = getAIRouter();
  const goal = agent.description ?? "do your job well";
  const focusClean = focus?.trim().slice(0, 500) || "";
  const searchGoal = focusClean ? `${goal} (focus: ${focusClean})` : goal;

  // Memory: (a) durable learnings the agent has accumulated (so it gets smarter
  // over time), and (b) what recent runs covered (so it does something new).
  const [prior, memories] = await Promise.all([
    prisma.task.findMany({
      where: {
        agentId,
        status: "COMPLETED",
        summary: { not: null },
        id: { not: taskId },
      },
      orderBy: { completedAt: "desc" },
      take: 3,
      select: { summary: true },
    }),
    prisma.agentMemory.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { content: true },
    }),
  ]);
  const learnedNote = memories.length
    ? `\n\nWhat you have learned from past runs (build on this, don't relearn it):\n${memories
        .map((m) => `- ${m.content}`)
        .join("\n")}`
    : "";
  const memoryNote = prior.length
    ? `\n\nYour recent runs already covered:\n${prior
        .map((p) => `- ${p.summary}`)
        .join("\n")}\nThis run, deliberately cover DIFFERENT material, sources, and angle.`
    : "";
  const focusNote = focusClean
    ? `\n\nFOR THIS RUN SPECIFICALLY, focus on: ${focusClean}`
    : "";
  const system =
    buildRunSystem(agent.personality, agent.description) +
    learnedNote +
    memoryNote +
    focusNote;

  let idx = 0;
  const saveStep = (label: string, result: string) =>
    prisma.taskStep.create({
      data: { taskId, stepIndex: idx++, thought: label, result },
    });

  const runOne = async (instruction: string, prior: string) => {
    const res = await router.run("agent", runStepMessages(system, instruction, prior));
    return res.content.replace(/^\s+/, "").trim() || "(no output)";
  };

  // planning
  cb.onPhase?.("planning");
  const plan = await runOne(RUN_STEPS[0].instruction, "");
  await saveStep("planning", plan);

  // researching (only when web search is configured)
  let block = "";
  if (hasWebSearch()) {
    cb.onPhase?.("researching");
    const g = await gatherSources(router, searchGoal, plan);
    block = g.block;
    await saveStep(
      "researching",
      block
        ? `searched the web, found ${g.count} sources:\n\n${block}`
        : "web search returned no usable results.",
    );
  }

  // working = the deliverable. Streamed to chat when onDelta is provided, with a
  // non-streamed fallback: reasoning models occasionally stream empty content,
  // and a real deliverable must never get lost.
  cb.onPhase?.("working");
  const workMessages = runStepMessages(system, workInstruction(block), plan);
  let final = "";
  if (cb.onDelta) {
    for await (const chunk of router.stream("agent", workMessages)) {
      final += chunk;
      cb.onDelta(chunk);
    }
    final = final.replace(/^\s+/, "").trim();
    if (!final) {
      // stream produced nothing; retry reliably and push the result to the client
      final = (await router.run("agent", workMessages)).content
        .replace(/^\s+/, "")
        .trim();
      if (final) cb.onDelta(final);
    }
  } else {
    final = (await router.run("agent", workMessages)).content
      .replace(/^\s+/, "")
      .trim();
  }
  final = final || "(no output)";
  await saveStep("working", final);

  const summary = await summarizeRun(router, final);

  // Remember durable learnings for future runs (best-effort; never fails a run).
  try {
    const learnings = await extractMemories(router, final);
    if (learnings.length) {
      await prisma.agentMemory.createMany({
        data: learnings.map((content) => ({ agentId, content })),
      });
    }
  } catch {
    // memory is best-effort
  }

  return { final, summary };
}

/** Synchronous run (page "run" button). The streamed variant lives in /api/run. */
export async function executeAgentRun(agentId: string): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, ownerId: true, personality: true, description: true },
  });
  if (!agent) return;

  const task = await prisma.task.create({
    data: {
      agentId: agent.id,
      userId: agent.ownerId,
      prompt: agent.description ?? "",
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  try {
    const { final, summary } = await runTaskPipeline(task.id, agent.id, agent);
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        result: final,
        summary,
        completedAt: new Date(),
      },
    });
  } catch {
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        result: "the run hit an error. try again in a moment.",
        completedAt: new Date(),
      },
    });
  }
}
