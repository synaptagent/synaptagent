import { getAIRouter, type ChatMessage, type UseCase } from "@/lib/ai";
import { getAgentPersonality } from "@/lib/data/agents";
import { hasWebSearch, readUrl, webSearch } from "@/lib/agent/web-search";
import { generateImageUrl, hasImageGen } from "@/lib/agent/image-gen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chat "modes" map to internal use cases. We never expose provider/model names.
const MODE_TO_USECASE: Record<string, UseCase> = {
  fast: "chat",
  smart: "agent",
  deep: "long_task",
};

const SYSTEM_PROMPT =
  "You are SynaptAgent, a helpful and direct autonomous AI agent. Answer concisely in plain language. No corporate filler. No em-dashes. Always respond in English.";

export async function POST(req: Request) {
  let body: { messages?: ChatMessage[]; mode?: string; agent?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const history = (body.messages ?? []).filter(
    (m): m is ChatMessage =>
      !!m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string",
  );
  const useCase = MODE_TO_USECASE[body.mode ?? "fast"] ?? "chat";

  // If the chat is scoped to a specific agent (?a=handle/name), use that agent's
  // personality as the system prompt so it replies in character.
  let systemPrompt = SYSTEM_PROMPT;
  if (typeof body.agent === "string" && body.agent.includes("/")) {
    const i = body.agent.indexOf("/");
    const personality = await getAgentPersonality(
      body.agent.slice(0, i),
      body.agent.slice(i + 1),
    );
    if (personality) {
      systemPrompt = `${personality}\n\nYou are in a live chat. Answer from your knowledge, concise and direct. You DO have a real web-research ability: when your operator RUNS you (the "run task" action), you search the web for current sources and produce a cited brief. So never say you cannot access the web. If the user wants the latest info or real sources, tell them to run you (or fork you and run it) for a fully researched, cited result. No corporate filler. No em-dashes. Always respond in English.`;
    }
  }

  const router = getAIRouter();

  // Agentic step: read pasted links, search the web when the question needs
  // current info, or generate an image — then ground the reply.
  let sourcesContext = "";
  let imageMarker = "";
  try {
    const lastUser =
      [...history].reverse().find((m) => m.role === "user")?.content ?? "";
    const urls = hasWebSearch()
      ? (lastUser.match(/https?:\/\/[^\s)]+/g) ?? []).slice(0, 2)
      : [];

    if (urls.length) {
      // the user pasted link(s): open and read them directly
      for (const u of urls) {
        const content = await readUrl(u);
        if (content) {
          sourcesContext += `\n\nYou opened ${u}. Its content:\n${content
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 3000)}`;
        }
      }
    } else if (lastUser.trim().length >= 6) {
      // one classifier picks the right tool (image / web search / none)
      const cls = await router.run("chat", [
        {
          role: "system",
          content:
            "Classify the user's latest request and reply in ONE line:\nIMAGE: <a vivid English image prompt> — if they want an image created, drawn, or generated.\nSEARCH: <a concise query> — if answering needs current web info (news, latest data, prices, recent events, specific people or products).\nNONE — otherwise.",
        },
        { role: "user", content: lastUser.slice(0, 500) },
      ]);
      const line = cls.content.trim();
      if (/^IMAGE:/i.test(line) && hasImageGen()) {
        const p = line.replace(/^IMAGE:/i, "").trim();
        if (p) imageMarker = `\n\n[[img:${generateImageUrl(p)}]]`;
      } else if (/^SEARCH:/i.test(line) && hasWebSearch()) {
        const q = line.replace(/^SEARCH:/i, "").trim().slice(0, 200);
        if (q) {
          const results = await webSearch(q, 4);
          if (results.length) {
            const block = results
              .map(
                (r, i) =>
                  `[${i + 1}] ${r.title}\n${r.url}\n${(r.raw || r.content)
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 1200)}`,
              )
              .join("\n\n");
            sourcesContext = `\n\nYou just searched the web and found these current sources. Use them to answer accurately and cite inline as [1], [2]. If they do not cover the question, say so plainly.\nSources:\n${block}`;
          }
        }
      }
    }
  } catch {
    // tools are best-effort; fall back to answering from knowledge
  }

  const encoder = new TextEncoder();
  const finalSystem = systemPrompt + sourcesContext;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (imageMarker) {
          // image-gen short-circuits the text answer
          controller.enqueue(encoder.encode(`here you go:${imageMarker}`));
          return;
        }
        for await (const chunk of router.stream(useCase, [
          { role: "system", content: finalSystem },
          ...history,
        ])) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch {
        // never leak internal error text (model names, infra wording) to users
        controller.enqueue(
          encoder.encode("\n\n(the agent ran into an error. please try again.)"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
