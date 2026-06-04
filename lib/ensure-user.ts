import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { baseHandle } from "@/lib/handle";
import type { User } from "@prisma/client";

// Handles a normal user must not be able to claim (official org, etc.).
const RESERVED = new Set([
  "synaptagent",
  "synapt",
  "admin",
  "official",
  "support",
  "system",
  "api",
]);

// Finds a username not yet taken or reserved (appends 2, 3, ... on collision).
async function availableUsername(base: string): Promise<string> {
  let u = base;
  let n = 2;
  while (
    RESERVED.has(u) ||
    (await prisma.user.findUnique({ where: { username: u }, select: { id: true } }))
  ) {
    u = `${base}${n++}`;
  }
  return u;
}

// Syncs the signed-in Clerk user into our DB on demand (no webhook needed in dev):
// call from any server component / server action that needs the DB user row.
// Returns null when nobody is signed in. The username (handle) is set once at
// create time and stays stable, so agent / profile URLs always resolve.
export async function ensureUser(): Promise<User | null> {
  const cu = await currentUser();
  if (!cu) return null;

  const email =
    cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)
      ?.emailAddress ??
    cu.emailAddresses[0]?.emailAddress ??
    `${cu.id}@clerk.local`;

  const displayName =
    [cu.firstName, cu.lastName].filter(Boolean).join(" ") || cu.username || null;

  const existing = await prisma.user.findUnique({ where: { clerkId: cu.id } });
  if (existing) {
    const base = { email, avatarUrl: cu.imageUrl, displayName };
    try {
      // sync the Clerk username if set; username is unique, so this can collide.
      return await prisma.user.update({
        where: { clerkId: cu.id },
        data: { ...base, username: cu.username ?? undefined },
      });
    } catch {
      // handle taken (or otherwise rejected): keep theirs, sync the rest.
      return prisma.user.update({ where: { clerkId: cu.id }, data: base });
    }
  }

  const username = await availableUsername(baseHandle(cu.username, cu.id));
  return prisma.user.create({
    data: {
      clerkId: cu.id,
      email,
      username,
      displayName,
      avatarUrl: cu.imageUrl,
    },
  });
}

// Lightweight read of the signed-in user's DB id (no upsert). Returns null when
// signed out or not yet synced. Use for read-only follow/fork checks.
export async function getViewerId(): Promise<string | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const u = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  return u?.id ?? null;
}
