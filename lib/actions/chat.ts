"use server";

import { prisma } from "@/lib/db";
import { ensureUser, getViewerId } from "@/lib/ensure-user";

// Persist one chat turn (user message + assistant reply). Creates the session on
// the first turn (title from the first message); appends after. Returns the id.
export async function saveChatTurn(input: {
  sessionId: string | null;
  agentRef: string | null;
  userMessage: string;
  assistantMessage: string;
}): Promise<{ sessionId: string | null }> {
  const user = await ensureUser();
  if (!user) return { sessionId: null };

  const msgs = [
    { role: "user", content: input.userMessage },
    { role: "assistant", content: input.assistantMessage },
  ];

  if (input.sessionId) {
    const owned = await prisma.chatSession.findFirst({
      where: { id: input.sessionId, userId: user.id },
      select: { id: true },
    });
    if (owned) {
      // nested create bumps the session's updatedAt (for recency sorting)
      await prisma.chatSession.update({
        where: { id: owned.id },
        data: { messages: { create: msgs } },
      });
      return { sessionId: owned.id };
    }
  }

  const session = await prisma.chatSession.create({
    data: {
      userId: user.id,
      agentRef: input.agentRef,
      title: input.userMessage.slice(0, 60),
      messages: { create: msgs },
    },
  });
  return { sessionId: session.id };
}

/** Whether the viewer owns this agent (handle/name) — gates the chat "run" button. */
export async function canRunAgent(agentRef: string | null): Promise<boolean> {
  if (!agentRef || !agentRef.includes("/")) return false;
  const viewerId = await getViewerId();
  if (!viewerId) return false;
  const i = agentRef.indexOf("/");
  const agent = await prisma.agent.findFirst({
    where: { owner: { username: agentRef.slice(0, i) }, name: agentRef.slice(i + 1) },
    select: { ownerId: true },
  });
  return Boolean(agent && agent.ownerId === viewerId);
}

export async function getChatSessions(): Promise<
  { id: string; title: string; agentRef: string | null }[]
> {
  const viewerId = await getViewerId();
  if (!viewerId) return [];
  return prisma.chatSession.findMany({
    where: { userId: viewerId },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: { id: true, title: true, agentRef: true },
  });
}

export async function getChatMessages(
  sessionId: string,
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const viewerId = await getViewerId();
  if (!viewerId) return [];
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: viewerId },
    select: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      },
    },
  });
  return (session?.messages ?? []).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const viewerId = await getViewerId();
  if (!viewerId) return;
  await prisma.chatSession
    .deleteMany({ where: { id: sessionId, userId: viewerId } })
    .catch(() => {});
}
