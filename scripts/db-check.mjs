// Quick connectivity check: connect through the pg driver adapter (same path the
// app uses at runtime) and count rows in each table. Run: node scripts/db-check.mjs
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const [users, agents, tasks, follows, forks] = await Promise.all([
    prisma.user.count(),
    prisma.agent.count(),
    prisma.task.count(),
    prisma.agentFollow.count(),
    prisma.fork.count(),
  ]);
  console.log("DB OK via pg adapter");
  console.log({ users, agents, tasks, agentFollows: follows, forks });
} catch (e) {
  console.error("DB ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
