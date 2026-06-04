"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/ensure-user";
import { TEMPLATES, type TemplateKey } from "@/lib/templates";
import { executeAgentRun } from "@/lib/agent/engine";

// Maps the /deploy picker ids to a template enum + default topic chips.
const TEMPLATE_BY_ID: Record<string, { key: TemplateKey; topics: string[] }> = {
  researcher: { key: "RESEARCHER", topics: ["research", "data"] },
  analyst: { key: "ANALYST", topics: ["trading", "data"] },
  writer: { key: "WRITER", topics: ["writing", "growth"] },
  monitor: { key: "MONITOR", topics: ["data", "research"] },
  digest: { key: "DIGEST", topics: ["research", "data"] },
  blank: { key: "CUSTOM", topics: [] },
};

const NAME_MAX = 32;
const GOAL_MAX = 600;

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Finds a name not taken by this owner (appends -2, -3, ... on collision).
async function availableName(ownerId: string, base: string): Promise<string> {
  let name = base;
  let n = 2;
  while (
    await prisma.agent.findFirst({ where: { ownerId, name }, select: { id: true } })
  ) {
    name = `${base}-${n++}`;
  }
  return name;
}

// Duck-typed Prisma unique-constraint check (avoids importing the error class).
function isUniqueError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

export async function deployAgent(input: {
  template: string;
  name: string;
  goal: string;
}): Promise<{ error: string } | void> {
  const user = await ensureUser();
  if (!user) redirect("/sign-in");
  const handle = user.username;
  if (!handle) {
    return { error: "your account needs a handle. reload and try again." };
  }

  const base = slugify(input.name).slice(0, NAME_MAX);
  const goal = input.goal.trim().slice(0, GOAL_MAX);
  if (base.length < 2 || goal.length < 5) {
    return { error: "name needs 2+ chars and a goal of 5+ chars." };
  }

  const tpl = TEMPLATE_BY_ID[input.template] ?? TEMPLATE_BY_ID.blank;
  const name = await availableName(user.id, base);

  try {
    await prisma.agent.create({
      data: {
        ownerId: user.id,
        name,
        slug: `${handle}-${name}`,
        description: goal,
        template: tpl.key,
        personality: TEMPLATES[tpl.key].personality,
        topics: tpl.topics,
        visibility: "PUBLIC",
      },
    });
  } catch (e) {
    if (isUniqueError(e)) return { error: "that name was just taken. try another." };
    throw e;
  }

  revalidatePath("/feed");
  revalidatePath(`/u/${handle}`);
  revalidatePath("/dashboard");
  redirect(`/agent/${handle}/${name}`);
}

// Fork = create a new agent based on an existing one, but with YOUR own goal,
// so the fork is your version (not a verbatim clone). Lineage is recorded.
export async function forkAgent(input: {
  originalAgentId: string;
  name: string;
  goal: string;
}): Promise<{ error: string } | void> {
  const user = await ensureUser();
  if (!user) redirect("/sign-in");
  const handle = user.username;
  if (!handle) {
    return { error: "your account needs a handle. reload and try again." };
  }

  const orig = await prisma.agent.findUnique({
    where: { id: input.originalAgentId },
    select: { id: true, template: true, personality: true, topics: true },
  });
  if (!orig) return { error: "agent not found." };

  const base = slugify(input.name).slice(0, NAME_MAX);
  const goal = input.goal.trim().slice(0, GOAL_MAX);
  if (base.length < 2 || goal.length < 5) {
    return { error: "name needs 2+ chars and a goal of 5+ chars." };
  }

  const name = await availableName(user.id, base);

  let created;
  try {
    created = await prisma.agent.create({
      data: {
        ownerId: user.id,
        name,
        slug: `${handle}-${name}`,
        description: goal,
        template: orig.template,
        personality: orig.personality,
        topics: orig.topics,
        visibility: "PUBLIC",
      },
    });
  } catch (e) {
    if (isUniqueError(e)) return { error: "that name was just taken. try another." };
    throw e;
  }

  await prisma.$transaction([
    prisma.fork.create({
      data: {
        forkerId: user.id,
        originalAgentId: orig.id,
        newAgentId: created.id,
      },
    }),
    prisma.agent.update({
      where: { id: orig.id },
      data: { forkCount: { increment: 1 } },
    }),
  ]);

  revalidatePath("/feed");
  revalidatePath(`/u/${handle}`);
  revalidatePath("/dashboard");
  redirect(`/agent/${handle}/${name}`);
}

export async function toggleFollow(agentId: string): Promise<{ following: boolean }> {
  const user = await ensureUser();
  if (!user) redirect("/sign-in");

  const existing = await prisma.agentFollow.findUnique({
    where: { followerId_agentId: { followerId: user.id, agentId } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.agentFollow.delete({ where: { id: existing.id } }),
      prisma.agent.update({
        where: { id: agentId },
        data: { followerCount: { decrement: 1 } },
      }),
    ]);
    revalidatePath("/dashboard");
    return { following: false };
  }

  await prisma.$transaction([
    prisma.agentFollow.create({ data: { followerId: user.id, agentId } }),
    prisma.agent.update({
      where: { id: agentId },
      data: { followerCount: { increment: 1 } },
    }),
  ]);
  revalidatePath("/dashboard");
  return { following: true };
}

export async function deleteAgent(agentId: string): Promise<{ error: string } | void> {
  const user = await ensureUser();
  if (!user) redirect("/sign-in");

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { ownerId: true, forkedFrom: { select: { originalAgentId: true } } },
  });
  if (!agent) return { error: "agent not found." };
  if (agent.ownerId !== user.id) return { error: "this is not your agent." };

  // if this was a fork, drop the original's fork count by one
  if (agent.forkedFrom) {
    await prisma.agent
      .update({
        where: { id: agent.forkedFrom.originalAgentId },
        data: { forkCount: { decrement: 1 } },
      })
      .catch(() => {});
  }

  await prisma.agent.delete({ where: { id: agentId } });

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Runs the agent's goal once (owner only). Synchronous for now (~30s); the
// background/multi-day worker is Fase 4. Logs steps to the DB as it goes.
export async function runAgent(agentId: string): Promise<{ error: string } | void> {
  const user = await ensureUser();
  if (!user) redirect("/sign-in");

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { ownerId: true, name: true, owner: { select: { username: true } } },
  });
  if (!agent) return { error: "agent not found." };
  if (agent.ownerId !== user.id) {
    return { error: "you can only run your own agents. fork it first." };
  }

  await executeAgentRun(agentId);

  if (agent.owner.username) {
    revalidatePath(`/agent/${agent.owner.username}/${agent.name}`);
  }
}

// Fase 4: set (or clear) a recurring auto-run schedule for an agent. Owner only.
// The in-process worker fires due schedules into the run queue. cadence "off"
// removes the schedule.
const CADENCES = ["hourly", "daily", "weekly"];

export async function setSchedule(
  agentId: string,
  cadence: string,
): Promise<{ error: string } | void> {
  const user = await ensureUser();
  if (!user) redirect("/sign-in");

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { ownerId: true, name: true, owner: { select: { username: true } } },
  });
  if (!agent) return { error: "agent not found." };
  if (agent.ownerId !== user.id) {
    return { error: "you can only schedule your own agents." };
  }

  if (cadence === "off") {
    await prisma.schedule.deleteMany({ where: { agentId } });
  } else if (CADENCES.includes(cadence)) {
    // idempotent upsert on the unique agentId (no find-then-write race); the
    // first scheduled run fires on the next worker tick, then recurs at cadence
    await prisma.schedule.upsert({
      where: { agentId },
      create: {
        agentId,
        userId: user.id,
        cadence,
        active: true,
        nextRunAt: new Date(),
      },
      update: {
        userId: user.id,
        cadence,
        active: true,
        nextRunAt: new Date(),
      },
    });
  } else {
    return { error: "invalid cadence." };
  }

  if (agent.owner.username) {
    revalidatePath(`/agent/${agent.owner.username}/${agent.name}`);
  }
}
