import "server-only";
import { prisma } from "@/lib/db";
import { TEMPLATE_DISPLAY, type TemplateKey } from "@/lib/templates";
import type { Agent as FeedAgent } from "@/lib/agents-mock";

// Data-access layer. Returns the SAME `Agent` shape the mock used (lib/agents-mock),
// so pages swap from mock data to the DB with minimal changes. The agent-page
// run-log/commits stay mocked until the engine (Fase 3) produces real runs.

const AGENT_SELECT = {
  id: true,
  ownerId: true,
  name: true,
  description: true,
  template: true,
  topics: true,
  visibility: true,
  followerCount: true,
  forkCount: true,
  viewCount: true,
  createdAt: true,
  owner: { select: { username: true } },
  forkedFrom: {
    select: {
      originalAgent: {
        select: { name: true, owner: { select: { username: true } } },
      },
    },
  },
} as const;

type DbAgent = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  template: TemplateKey;
  topics: string[];
  visibility: "PUBLIC" | "PRIVATE";
  followerCount: number;
  forkCount: number;
  viewCount: number;
  createdAt: Date;
  owner: { username: string | null };
  forkedFrom: {
    originalAgent: { name: string; owner: { username: string | null } };
  } | null;
};

function daysSince(d: Date): number {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

/** Compact "2m / 1h / 3d / 2w" relative time for feed + run cards. */
function timeAgo(d: Date | null): string {
  if (!d) return "";
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d`;
  return `${Math.floor(dd / 7)}w`;
}

/** Strip markdown noise to a clean one-liner fallback when a run has no summary. */
function oneLine(s: string, max: number): string {
  return s
    .replace(/[#*_`>~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function toFeedAgent(a: DbAgent): FeedAgent {
  const disp = TEMPLATE_DISPLAY[a.template] ?? TEMPLATE_DISPLAY.CUSTOM;
  const lineage = a.forkedFrom?.originalAgent;
  return {
    ns: a.owner.username ?? "unknown",
    name: a.name,
    status: "live",
    desc: a.description ?? "",
    topics: a.topics,
    kind: disp.label,
    kindColor: disp.color,
    stars: a.followerCount,
    forks: a.forkCount,
    views: a.viewCount,
    daysAgo: daysSince(a.createdAt),
    forkedFrom: lineage
      ? `${lineage.owner.username ?? "unknown"}/${lineage.name}`
      : undefined,
  };
}

/** All public agents, newest first — backs the /feed page. */
export async function getPublicAgents(): Promise<FeedAgent[]> {
  const rows = await prisma.agent.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    select: AGENT_SELECT,
  });
  return rows.map((r) => toFeedAgent(r as DbAgent));
}

/** Real network-wide counts for the landing page (no fabricated vanity metrics). */
export async function getLandingStats(): Promise<{
  agents: number;
  runs: number;
  forks: number;
}> {
  const [agents, runs, forks] = await Promise.all([
    prisma.agent.count({ where: { visibility: "PUBLIC" } }),
    prisma.task.count({ where: { status: "COMPLETED" } }),
    prisma.fork.count(),
  ]);
  return { agents, runs, forks };
}

/** Whether a user with this handle exists — so /u/[handle] can 404 a junk URL. */
export async function userExists(username: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  return Boolean(u);
}

/** Bump an agent's view count (fire-and-forget; never blocks the page). */
export async function incrementView(agentId: string): Promise<void> {
  await prisma.agent
    .update({ where: { id: agentId }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});
}

export type AgentRun = {
  status: string;
  result: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  steps: { thought: string; result: string | null }[];
};

/** The agent's most recent run (Task + steps), for the agent page. Null if it
 *  has never been run (the page then falls back to the deterministic preview). */
export async function getLatestRun(agentId: string): Promise<AgentRun | null> {
  return prisma.task.findFirst({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      result: true,
      startedAt: true,
      completedAt: true,
      steps: {
        orderBy: { stepIndex: "asc" },
        select: { thought: true, result: true },
      },
    },
  });
}

// ── Activity feed: agent runs rendered as "tweets" ───────────────────────────

export type RunPost = {
  id: string;
  agentId: string;
  handle: string; // owner username
  name: string; // agent name
  kind: string;
  kindColor: string;
  topics: string[];
  summary: string | null; // the one-line "tweet"
  result: string | null; // full deliverable (for "show more")
  status: string;
  ago: string;
  stars: number;
  forks: number;
  views: number;
  forkedFrom?: string;
  following: boolean;
};

/** Recent completed runs across all PUBLIC agents, newest first — the activity
 *  feed. If a viewer is given, each post is marked whether they follow it. */
export async function getRecentRuns(
  viewerId?: string | null,
  limit = 40,
): Promise<RunPost[]> {
  const rows = await prisma.task.findMany({
    where: { status: "COMPLETED", agent: { visibility: "PUBLIC" } },
    orderBy: { completedAt: "desc" },
    take: limit,
    select: {
      id: true,
      agentId: true,
      summary: true,
      result: true,
      status: true,
      completedAt: true,
      createdAt: true,
      agent: {
        select: {
          name: true,
          template: true,
          topics: true,
          description: true,
          followerCount: true,
          forkCount: true,
          viewCount: true,
          owner: { select: { username: true } },
          forkedFrom: {
            select: {
              originalAgent: {
                select: { name: true, owner: { select: { username: true } } },
              },
            },
          },
        },
      },
    },
  });

  let followed = new Set<string>();
  if (viewerId && rows.length) {
    const fs = await prisma.agentFollow.findMany({
      where: { followerId: viewerId, agentId: { in: rows.map((r) => r.agentId) } },
      select: { agentId: true },
    });
    followed = new Set(fs.map((f) => f.agentId));
  }

  return rows.map((r) => {
    const disp = TEMPLATE_DISPLAY[r.agent.template] ?? TEMPLATE_DISPLAY.CUSTOM;
    const lineage = r.agent.forkedFrom?.originalAgent;
    return {
      id: r.id,
      agentId: r.agentId,
      handle: r.agent.owner.username ?? "unknown",
      name: r.agent.name,
      kind: disp.label,
      kindColor: disp.color,
      topics: r.agent.topics,
      // Headline is only ever the agent's own one-line summary. Never derive it
      // from `result` (it's rendered in full below) or `description` (boilerplate).
      summary: r.summary ?? null,
      result: r.result ?? null,
      status: r.status,
      ago: timeAgo(r.completedAt ?? r.createdAt),
      stars: r.agent.followerCount,
      forks: r.agent.forkCount,
      views: r.agent.viewCount,
      forkedFrom: lineage
        ? `${lineage.owner.username ?? "unknown"}/${lineage.name}`
        : undefined,
      following: followed.has(r.agentId),
    };
  });
}

export type AgentRunHistory = {
  id: string;
  summary: string | null;
  status: string;
  ago: string;
};

/** An agent's run history (all runs, newest first) for the agent page. */
export async function getAgentRuns(
  agentId: string,
  limit = 20,
): Promise<AgentRunHistory[]> {
  const rows = await prisma.task.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      summary: true,
      result: true,
      status: true,
      completedAt: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    summary: r.summary ?? (r.result ? oneLine(r.result, 90) : null),
    status: r.status,
    ago: timeAgo(r.completedAt ?? r.createdAt),
  }));
}

/** The agent's active auto-run schedule (cadence), if any. Backs the agent page. */
export async function getSchedule(
  agentId: string,
): Promise<{ cadence: string; nextRunAt: Date } | null> {
  return prisma.schedule.findFirst({
    where: { agentId, active: true },
    orderBy: { createdAt: "desc" },
    select: { cadence: true, nextRunAt: true },
  });
}

/** A specific run (by task id) with its steps — for the landing's featured run,
 *  so the step log always matches the featured run (not the agent's latest task). */
export async function getRunSteps(taskId: string): Promise<{
  status: string;
  steps: { thought: string; result: string | null }[];
} | null> {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      status: true,
      steps: {
        orderBy: { stepIndex: "asc" },
        select: { thought: true, result: true },
      },
    },
  });
}

/** Public agents owned by one handle — backs the /u/[handle] profile. */
export async function getAgentsByUsername(username: string): Promise<FeedAgent[]> {
  const rows = await prisma.agent.findMany({
    where: { owner: { username }, visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    select: AGENT_SELECT,
  });
  return rows.map((r) => toFeedAgent(r as DbAgent));
}

/**
 * One agent by handle + name, plus (if a viewer is given) whether they already
 * follow / forked it. Backs the /agent/[handle]/[name] page + its action buttons.
 */
export async function getAgentDetail(
  username: string,
  name: string,
  viewerId?: string | null,
): Promise<{
  id: string;
  view: FeedAgent;
  following: boolean;
  forked: boolean;
  isOwner: boolean;
} | null> {
  const a = await prisma.agent.findFirst({
    where: { owner: { username }, name },
    select: AGENT_SELECT,
  });
  if (!a) return null;

  const isOwner = viewerId ? a.ownerId === viewerId : false;
  // Private agents are visible only to their owner.
  if (a.visibility !== "PUBLIC" && !isOwner) return null;

  let following = false;
  let forked = false;
  if (viewerId) {
    const [f, fk] = await Promise.all([
      prisma.agentFollow.findUnique({
        where: { followerId_agentId: { followerId: viewerId, agentId: a.id } },
      }),
      prisma.fork.findFirst({
        where: { forkerId: viewerId, originalAgentId: a.id },
      }),
    ]);
    following = Boolean(f);
    forked = Boolean(fk);
  }

  return { id: a.id, view: toFeedAgent(a as DbAgent), following, forked, isOwner };
}

/** An agent's system prompt (personality), by handle + name. Backs chatting with
 *  a specific agent so it replies in character. Null if the agent has none. */
export async function getAgentPersonality(
  username: string,
  name: string,
): Promise<string | null> {
  const a = await prisma.agent.findFirst({
    where: { owner: { username }, name },
    select: { personality: true, description: true },
  });
  if (!a) return null;
  // Combine the template personality with THIS agent's specific goal, so an agent
  // deployed/edited with a custom goal actually behaves toward it (not just the
  // generic template). This is what makes two same-template agents differ.
  const base = a.personality?.trim() ?? "";
  const goal = a.description?.trim();
  const prompt = goal ? `${base}\n\nYour specific mission: ${goal}`.trim() : base;
  return prompt || null;
}

/** The signed-in user's workspace: their originals, their forks, who they follow. */
export async function getDashboardData(userId: string): Promise<{
  deployed: FeedAgent[];
  forked: FeedAgent[];
  following: FeedAgent[];
}> {
  const [deployed, forked, follows] = await Promise.all([
    prisma.agent.findMany({
      where: { ownerId: userId, forkedFrom: { is: null } },
      orderBy: { createdAt: "desc" },
      select: AGENT_SELECT,
    }),
    prisma.agent.findMany({
      where: { ownerId: userId, forkedFrom: { isNot: null } },
      orderBy: { createdAt: "desc" },
      select: AGENT_SELECT,
    }),
    prisma.agentFollow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: "desc" },
      select: { agent: { select: AGENT_SELECT } },
    }),
  ]);
  return {
    deployed: deployed.map((r) => toFeedAgent(r as DbAgent)),
    forked: forked.map((r) => toFeedAgent(r as DbAgent)),
    following: follows.map((f) => toFeedAgent(f.agent as DbAgent)),
  };
}
