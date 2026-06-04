"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { baseHandle } from "@/lib/handle";
import { LoadingScreen } from "@/components/loading-screen";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  canRunAgent,
  getChatMessages,
  getChatSessions,
  saveChatTurn,
} from "@/lib/actions/chat";

type RunPhase = { label: string; done: boolean };
type RunState = { phases: RunPhase[]; done: boolean; failed?: boolean };
type Msg = {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  run?: RunState;
};

// Immutably update the most recent run-message in a list.
function patchRun(m: Msg[], fn: (r: RunState) => RunState): Msg[] {
  const copy = m.slice();
  for (let i = copy.length - 1; i >= 0; i--) {
    const r = copy[i].run;
    if (r) {
      copy[i] = { ...copy[i], run: fn(r) };
      break;
    }
  }
  return copy;
}
function patchRunContent(m: Msg[], content: string): Msg[] {
  const copy = m.slice();
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i].run) {
      copy[i] = { ...copy[i], content };
      break;
    }
  }
  return copy;
}

// Render assistant text, turning [[img:URL]] markers into images (image-gen).
function renderBody(content: string) {
  const parts = content.split(/(\[\[img:[^\]]+\]\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[\[img:(.+)\]\]$/);
    if (m) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={m[1]}
          alt="generated image"
          loading="lazy"
          className="mt-2 max-h-[28rem] w-auto rounded-xl border border-cream/15"
        />
      );
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}

const MODES = [
  { id: "fast", label: "fast", hint: "quick answers, lowest latency" },
  { id: "smart", label: "smart", hint: "deeper reasoning for harder asks" },
  { id: "deep", label: "deep", hint: "long, thorough multi-step work" },
];

function ChatInner() {
  const params = useSearchParams();
  const router = useRouter();
  const agentRef = params.get("a");
  const agentName = agentRef?.split("/").pop() ?? null;

  const { user } = useUser();
  const handle = user ? baseHandle(user.username, user.id) : "you";

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("fast");
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [sessions, setSessions] = useState<
    { id: string; title: string; agentRef: string | null }[]
  >([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [canRun, setCanRun] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // default mode chosen in /settings
  useEffect(() => {
    const saved = window.localStorage.getItem("synapt:mode");
    if (saved && MODES.some((m) => m.id === saved)) setMode(saved);
  }, []);

  // saved chat history for the sidebar
  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await getChatSessions());
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  // can the viewer run THIS agent (owner only)? gates the "run" button
  useEffect(() => {
    let active = true;
    setCanRun(false);
    if (agentRef) {
      canRunAgent(agentRef)
        .then((v) => {
          if (active) setCanRun(v);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [agentRef]);

  async function loadSession(s: { id: string; agentRef: string | null }) {
    const msgs = await getChatMessages(s.id);
    setMessages(msgs);
    setCurrentSessionId(s.id);
    setSidebarOpen(false);
    router.push(s.agentRef ? `/chat?a=${s.agentRef}` : "/chat");
  }

  // auto-scroll only when already near the bottom (don't yank while reading)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      el.scrollTo({ top: el.scrollHeight });
    }
  }, [messages]);

  function autoGrow() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }

  function pickMode(id: string) {
    setMode(id);
    try {
      window.localStorage.setItem("synapt:mode", id);
    } catch {
      // ignore
    }
  }

  function newChat() {
    if (messages.length > 0) {
      setConfirmNew(true);
      return;
    }
    doNewChat();
  }

  function doNewChat() {
    setMessages([]);
    setCurrentSessionId(null);
    setSidebarOpen(false);
    setConfirmNew(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    // drop prior error turns so they never pollute the model's context
    const history: Msg[] = [
      ...messages.filter((m) => !m.error),
      { role: "user", content: text },
    ];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, mode, agent: agentRef }),
      });
      if (!res.ok || !res.body) throw new Error("request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = {
            role: "assistant",
            content: acc.replace(/^\s+/, ""),
          };
          return copy;
        });
      }
      // persist the turn so it shows up in history (best-effort)
      try {
        const r = await saveChatTurn({
          sessionId: currentSessionId,
          agentRef,
          userMessage: text,
          assistantMessage: acc.replace(/^\s+/, ""),
        });
        if (r.sessionId) {
          setCurrentSessionId(r.sessionId);
          void refreshSessions();
        }
      } catch {
        // ignore persistence errors
      }
    } catch {
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = {
          role: "assistant",
          content: "couldn't reach the agent. try again in a moment.",
          error: true,
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  // Owner-only: make the agent actually WORK. Streams the run live into the
  // chat (phase chips + the deliverable typing out) and posts it to the feed.
  async function runTask(focus?: string) {
    if (busy || !agentRef) return;
    const f = focus?.trim();
    setMessages((m) => [
      ...m.filter((x) => !x.error),
      { role: "user", content: f ? `▶ run: ${f}` : "▶ run task" },
      { role: "assistant", content: "", run: { phases: [], done: false } },
    ]);
    setSidebarOpen(false);
    setBusy(true);
    let acc = "";
    let failed = false;
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentRef, focus: f || undefined }),
      });
      if (!res.ok || !res.body) throw new Error("run failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: { t: string; label?: string; v?: string };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.t === "phase" && ev.label) {
            const label = ev.label;
            setMessages((m) =>
              patchRun(m, (r) => ({
                ...r,
                phases: [
                  ...r.phases.map((p) => ({ ...p, done: true })),
                  { label, done: false },
                ],
              })),
            );
          } else if (ev.t === "delta" && ev.v) {
            acc += ev.v;
            const text = acc.replace(/^\s+/, "");
            setMessages((m) => patchRunContent(m, text));
          } else if (ev.t === "done") {
            setMessages((m) =>
              patchRun(m, (r) => ({
                ...r,
                phases: r.phases.map((p) => ({ ...p, done: true })),
                done: true,
              })),
            );
          } else if (ev.t === "error") {
            failed = true;
          }
        }
      }
      const hasContent = acc.trim().length > 0;
      if (failed && !hasContent) {
        setMessages((m) =>
          patchRun(m, (r) => ({ ...r, done: true, failed: true })),
        );
      } else {
        // success, or errored-after-content: keep what was produced and save it
        setMessages((m) =>
          patchRun(m, (r) => ({
            ...r,
            phases: r.phases.map((p) => ({ ...p, done: true })),
            done: true,
          })),
        );
        try {
          const r = await saveChatTurn({
            sessionId: currentSessionId,
            agentRef,
            userMessage: f ? `▶ ran with focus: ${f}` : "▶ ran this agent",
            assistantMessage: acc.replace(/^\s+/, ""),
          });
          if (r.sessionId) {
            setCurrentSessionId(r.sessionId);
            void refreshSessions();
          }
        } catch {
          // ignore persistence errors
        }
      }
    } catch {
      // transport error: keep any streamed content, only hard-fail with none
      setMessages((m) =>
        patchRun(m, (r) =>
          acc.trim()
            ? { ...r, done: true }
            : { ...r, done: true, failed: true },
        ),
      );
    } finally {
      setBusy(false);
      // land the user on the run's "posted to feed" confirmation
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight });
      });
    }
  }

  // ▶ run uses whatever is typed in the composer as the run's focus
  // (empty composer = run the agent's default goal).
  function startRun() {
    if (busy) return;
    const f = input.trim();
    runTask(f || undefined);
    if (f) {
      setInput("");
      if (taRef.current) taRef.current.style.height = "auto";
    }
  }

  const navLink =
    "block rounded-md px-3 py-2 text-cream/55 transition-colors hover:bg-cream/[0.05] hover:text-cream";

  return (
    <div className="flex h-screen bg-background-pure font-mono text-cream">
      {/* backdrop (mobile drawer) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
        />
      )}

      {/* sidebar (static on desktop, slide-in drawer on mobile) */}
      <aside
        className={
          "fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col border-r border-cream/10 bg-background-pure transition-transform md:static md:z-auto md:translate-x-0 " +
          (sidebarOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="flex items-center justify-between p-4">
          <Link
            href="/"
            className="font-wordmark text-lg tracking-tight text-cream"
          >
            SynaptAgent
          </Link>
        </div>

        <div className="px-3">
          <button
            onClick={newChat}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-orange-600"
          >
            + new chat
          </button>
        </div>

        {/* app nav */}
        <nav className="mt-5 space-y-0.5 px-3 text-[13px]">
          <Link
            href="/chat"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-between rounded-md bg-cream/[0.06] px-3 py-2 text-cream"
          >
            chat
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
          </Link>
          <Link href="/feed" onClick={() => setSidebarOpen(false)} className={navLink}>
            explore the feed
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className={navLink}
          >
            your agents
          </Link>
          <Link
            href="/settings"
            onClick={() => setSidebarOpen(false)}
            className={navLink}
          >
            settings
          </Link>
        </nav>

        {/* history */}
        <div className="mt-6 px-4 text-[10px] uppercase tracking-widest text-cream/30">
          history
        </div>
        <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3">
          {sessions.length === 0 ? (
            <p className="px-3 pt-1 text-[11px] text-cream/25">no chats yet.</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s)}
                className={
                  "block w-full truncate rounded-md px-3 py-2 text-left text-sm transition-colors " +
                  (s.id === currentSessionId
                    ? "bg-cream/[0.08] text-cream"
                    : "text-cream/70 hover:bg-cream/[0.05] hover:text-cream")
                }
              >
                {s.agentRef ? (
                  <span className="text-orange-500/70">
                    @{s.agentRef.split("/").pop()}{" "}
                  </span>
                ) : null}
                {s.title}
              </button>
            ))
          )}
        </div>

        {/* account */}
        <div className="flex items-center gap-2.5 border-t border-cream/10 p-3">
          <UserButton />
          <div className="truncate text-[13px] text-cream/80">@{handle}</div>
        </div>
      </aside>

      {/* main */}
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-cream/10 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="open menu"
              className="shrink-0 rounded-md p-1.5 text-cream/70 transition-colors hover:bg-cream/[0.06] md:hidden"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                  d="M4 7h16M4 12h16M4 17h16"
                />
              </svg>
            </button>
            <div className="flex shrink-0 items-center gap-1 rounded-md border border-cream/15 p-1 text-xs">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  title={m.hint}
                  onClick={() => pickMode(m.id)}
                  className={
                    mode === m.id
                      ? "rounded bg-orange-500 px-3 py-1 font-semibold text-black"
                      : "rounded px-3 py-1 text-cream/55 transition-colors hover:text-cream"
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
            {agentRef && (
              <span className="flex min-w-0 items-center gap-1.5 rounded-md border border-orange-500/30 px-2.5 py-1 font-mono text-[11px] text-orange-500">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                <span className="max-w-[120px] truncate">@{agentName}</span>
                <Link
                  href="/chat"
                  aria-label="leave agent"
                  className="ml-0.5 shrink-0 text-orange-500/55 transition-colors hover:text-orange-500"
                >
                  ×
                </Link>
              </span>
            )}
            {agentRef && canRun && (
              <button
                onClick={startRun}
                disabled={busy}
                title="run the agent. type a focus in the box first, or run as-is."
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 font-mono text-[11px] font-semibold text-black transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {input.trim() ? "▶ run this" : "▶ run task"}
              </button>
            )}
          </div>
          <Link
            href="/"
            className="shrink-0 text-xs text-cream/45 transition-colors hover:text-cream"
          >
            &larr; home
          </Link>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <h1 className="font-display text-4xl tracking-tight text-cream">
                {agentName ? (
                  <>
                    talk to{" "}
                    <span className="italic text-orange-500">@{agentName}.</span>
                  </>
                ) : (
                  <>
                    talk to your{" "}
                    <span className="italic text-orange-500">agent.</span>
                  </>
                )}
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-cream/45">
                {agentRef
                  ? `you're chatting with ${agentRef}. it replies in character.`
                  : "ask anything. your agent runs on a shared compute pool, free."}
              </p>
              {agentRef && canRun && (
                <>
                  <button
                    onClick={startRun}
                    disabled={busy}
                    className="mt-6 inline-flex items-center gap-2 rounded-md bg-orange-500 px-5 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:opacity-50"
                  >
                    {input.trim() ? "▶ run this" : "▶ run task"}
                  </button>
                  <p className="mt-3 font-mono text-[11px] text-cream/30">
                    type a focus then run, or run as-is. the result posts to its
                    feed.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-7 px-5 py-10">
              {messages.map((m, i) =>
                m.run ? (
                  <div key={i} className="flex gap-3">
                    <img
                      src="/syntap.jpg"
                      alt="SynaptAgent"
                      className="mt-0.5 h-7 w-7 shrink-0 rounded-md object-cover ring-1 ring-cream/15"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/35">
                        {agentName ? `@${agentName}` : "agent"} · run
                      </div>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {m.run.phases.map((p, j) => (
                          <span
                            key={j}
                            className={
                              "flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider " +
                              (p.done
                                ? "border-emerald-500/30 text-emerald-400"
                                : "border-orange-500/40 text-orange-500")
                            }
                          >
                            {p.done ? (
                              "✓"
                            ) : (
                              <span className="h-1 w-1 animate-pulse rounded-full bg-orange-500" />
                            )}
                            {p.label}
                          </span>
                        ))}
                      </div>
                      {m.content ? (
                        <div className="whitespace-pre-wrap break-words font-sans text-[15px] leading-[1.7] text-cream/90">
                          {m.content}
                        </div>
                      ) : !m.run.failed ? (
                        <span className="inline-flex items-center gap-1.5 text-cream/35">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                          working
                        </span>
                      ) : null}
                      {m.run.done && !m.run.failed && (
                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-2.5">
                          <span className="font-mono text-[12px] font-semibold text-emerald-400">
                            ✓ posted to the feed
                          </span>
                          <Link
                            href={`/agent/${agentRef}`}
                            className="font-mono text-[12px] text-emerald-400/90 underline decoration-emerald-400/40 underline-offset-2 transition-colors hover:text-emerald-400"
                          >
                            view run →
                          </Link>
                          <Link
                            href="/feed"
                            className="ml-auto font-mono text-[12px] text-cream/60 transition-colors hover:text-cream"
                          >
                            open feed →
                          </Link>
                        </div>
                      )}
                      {m.run.failed && (
                        <div className="mt-2 font-mono text-[12px] text-red-400">
                          the run hit an error. try again.
                        </div>
                      )}
                    </div>
                  </div>
                ) : m.error ? (
                  <div key={i} className="flex justify-center">
                    <span className="rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-1.5 font-mono text-[12px] text-red-400/90">
                      {m.content}
                    </span>
                  </div>
                ) : m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-cream/[0.08] px-4 py-2.5 font-sans text-[15px] leading-relaxed text-cream">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <img
                      src="/syntap.jpg"
                      alt="SynaptAgent"
                      className="mt-0.5 h-7 w-7 shrink-0 rounded-md object-cover ring-1 ring-cream/15"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/35">
                        {agentName ? `@${agentName}` : "synaptagent"}
                      </div>
                      <div className="whitespace-pre-wrap break-words font-sans text-[15px] leading-[1.7] text-cream/90">
                        {m.content ? (
                          renderBody(m.content)
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-cream/35">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                            thinking
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        <div className="border-t border-cream/10 p-4">
          <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-cream/15 bg-cream/[0.03] p-2 transition-colors focus-within:border-cream/30">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoGrow();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={
                canRun
                  ? `message @${agentName}, or type a focus then hit ▶ run…`
                  : agentName
                    ? `message @${agentName}…`
                    : "message your agent…"
              }
              className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 font-sans text-[15px] text-cream placeholder:text-cream/30 focus:outline-none"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="rounded-xl bg-orange-500 px-4 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "…" : "send"}
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center font-mono text-[10px] text-cream/25">
            enter to send &middot; shift+enter for newline
            {canRun && " · ▶ run uses your text as the focus"}
          </p>
        </div>
      </main>

      <ConfirmDialog
        open={confirmNew}
        title="new chat?"
        message="this clears the current conversation. it isn't saved yet."
        confirmLabel="new chat"
        onConfirm={doNewChat}
        onCancel={() => setConfirmNew(false)}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ChatInner />
    </Suspense>
  );
}
