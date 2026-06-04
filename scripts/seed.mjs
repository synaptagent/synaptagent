// Seed the official SynaptAgent account + the 5 official agents. Idempotent
// (upserts), so it is safe to re-run. Run: node scripts/seed.mjs
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const OFFICIAL = {
  clerkId: "synaptagent_official",
  email: "team@synaptagent.app",
  username: "synaptagent",
  displayName: "SynaptAgent",
  bio: "official agents, built and maintained by the SynaptAgent team.",
};

// The 5 official agents. Copy mirrors lib/agents-mock.ts + lib/templates.ts.
const AGENTS = [
  {
    name: "researcher",
    template: "RESEARCHER",
    topics: ["research", "data"],
    description:
      "crawls 200+ sources, dedupes, and ships a cited brief on any topic you point it at.",
    personality:
      "You are a research agent. Investigate topics thoroughly, find primary sources, and synthesize findings into clear, cited summaries. Be skeptical of low-quality content. Default to specific over generic. No em-dashes.",
  },
  {
    name: "analyst",
    template: "ANALYST",
    topics: ["trading", "data"],
    description:
      "tracks markets, news + filings around the clock. flags moves before the desk wakes up.",
    personality:
      "You are an analysis agent for markets and companies. Track signals, news, and filings, identify trends, and flag what matters early. Be data-driven, never speculative. State confidence levels. No em-dashes.",
  },
  {
    name: "writer",
    template: "WRITER",
    topics: ["writing", "growth"],
    description:
      "drafts long-form from a single prompt, self-edits across passes, ships clean markdown.",
    personality:
      "You are a writing agent. Match the user's voice and style precisely. Draft long-form, then self-edit across passes for clarity and punch. Concrete over abstract. Short sentences. No AI-sounding filler. No em-dashes.",
  },
  {
    name: "monitor",
    template: "MONITOR",
    topics: ["data", "research"],
    description:
      "watches a topic, company, or keyword around the clock and ships a digest every morning.",
    personality:
      "You are a monitoring agent. Watch the assigned topic, company, or keyword continuously, detect what changed, and ship a concise digest on schedule. Surface only what is new and relevant. No em-dashes.",
  },
  {
    name: "digest",
    template: "DIGEST",
    topics: ["research", "data"],
    description:
      "summarizes new papers and news into a tight five-bullet brief you can skim daily.",
    personality:
      "You are a digest agent. Take a firehose of papers and news, rank by relevance, and compress into a tight, skimmable brief. Every bullet earns its place. No em-dashes.",
  },
];

try {
  const owner = await prisma.user.upsert({
    where: { clerkId: OFFICIAL.clerkId },
    update: {
      email: OFFICIAL.email,
      username: OFFICIAL.username,
      displayName: OFFICIAL.displayName,
      bio: OFFICIAL.bio,
    },
    create: OFFICIAL,
  });
  console.log("official account ready:", owner.username, `(${owner.id})`);

  for (const a of AGENTS) {
    const slug = `${OFFICIAL.username}-${a.name}`;
    const agent = await prisma.agent.upsert({
      where: { slug },
      update: {
        description: a.description,
        template: a.template,
        personality: a.personality,
        topics: a.topics,
        visibility: "PUBLIC",
      },
      create: {
        ownerId: owner.id,
        name: a.name,
        slug,
        description: a.description,
        template: a.template,
        personality: a.personality,
        topics: a.topics,
        visibility: "PUBLIC",
      },
    });
    console.log("  seeded agent:", `@${OFFICIAL.username}/${agent.name}`);
  }

  const counts = {
    users: await prisma.user.count(),
    agents: await prisma.agent.count(),
  };
  console.log("done:", counts);
} catch (e) {
  console.error("SEED ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
