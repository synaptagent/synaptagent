"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  deleteAgent,
  runAgent,
  setSchedule,
  toggleFollow,
} from "@/lib/actions/agents";
import { ConfirmDialog } from "@/components/confirm-dialog";

// Owner: run (primary) + chat + delete. Everyone else: chat (primary) + fork +
// follow. The rest of the agent page is server-rendered.
export function AgentActions({
  agentId,
  handle,
  name,
  initialFollowing,
  isOwner,
  initialCadence,
}: {
  agentId: string;
  handle: string;
  name: string;
  initialFollowing: boolean;
  isOwner: boolean;
  initialCadence: string;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [cadence, setCadence] = useState(initialCadence);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const ref = `${encodeURIComponent(handle)}/${encodeURIComponent(name)}`;
  const chatHref = `/chat?a=${ref}`;
  const forkHref = `/agent/${encodeURIComponent(handle)}/${encodeURIComponent(name)}/fork`;

  function onRun() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await runAgent(agentId); // revalidates the page with the run
      if (res?.error) setError(res.error);
    });
  }

  function onFollow() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await toggleFollow(agentId);
      setFollowing(res.following);
    });
  }

  function onSchedule(c: string) {
    if (pending || c === cadence) return;
    setError(null);
    const prev = cadence;
    setCadence(c);
    startTransition(async () => {
      const res = await setSchedule(agentId, c);
      if (res?.error) {
        setError(res.error);
        setCadence(prev);
      }
    });
  }

  function onDelete() {
    if (pending) return;
    setConfirmDelete(true);
  }

  function doDelete() {
    setConfirmDelete(false);
    setError(null);
    startTransition(async () => {
      const res = await deleteAgent(agentId);
      if (res?.error) setError(res.error);
    });
  }

  const outlineBtn =
    "rounded-md border border-cream/20 px-5 py-2.5 text-center font-mono text-sm text-cream transition-colors hover:border-cream/50 disabled:opacity-60";

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:min-w-[240px] sm:items-end">
      {isOwner ? (
        <>
          <button
            onClick={onRun}
            disabled={pending}
            className="rounded-md bg-orange-500 px-5 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "running… (~30s)" : "run agent"}
          </button>
          <div className="flex gap-2">
            <Link href={chatHref} className={outlineBtn}>
              chat
            </Link>
            <button
              onClick={onDelete}
              disabled={pending}
              className="rounded-md border border-red-500/40 px-5 py-2.5 font-mono text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
            >
              delete
            </button>
          </div>
          <span className="font-mono text-[11px] text-cream/35 sm:text-right">
            this agent is yours
          </span>

          <div className="mt-2 flex flex-col gap-1.5 border-t border-cream/10 pt-3 sm:items-end">
            <span className="font-mono text-[11px] uppercase tracking-wider text-cream/35">
              auto-run
            </span>
            <div className="flex flex-wrap gap-1 sm:justify-end">
              {(["off", "hourly", "daily", "weekly"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => onSchedule(c)}
                  disabled={pending}
                  className={
                    "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors disabled:opacity-60 " +
                    (cadence === c
                      ? "border-orange-500/50 bg-orange-500/10 text-orange-500"
                      : "border-cream/15 text-cream/55 hover:border-cream/40 hover:text-cream")
                  }
                >
                  {c}
                </button>
              ))}
            </div>
            {cadence !== "off" && (
              <span className="font-mono text-[10px] text-cream/40 sm:text-right">
                runs {cadence}, on its own
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <Link
            href={chatHref}
            className="rounded-md bg-orange-500 px-5 py-2.5 text-center font-mono text-sm font-semibold text-black transition-colors hover:bg-orange-600"
          >
            chat with this agent
          </Link>
          <div className="flex gap-2">
            <Link href={forkHref} className={outlineBtn}>
              fork
            </Link>
            <button
              onClick={onFollow}
              disabled={pending}
              className={
                "rounded-md border px-5 py-2.5 font-mono text-sm transition-colors disabled:opacity-60 " +
                (following
                  ? "border-orange-500/50 text-orange-500"
                  : "border-cream/20 text-cream hover:border-cream/50")
              }
            >
              {following ? "following ✓" : "follow"}
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="font-mono text-[11px] text-red-400 sm:text-right">{error}</p>
      )}
      {following && (
        <Link
          href="/dashboard"
          className="text-center font-mono text-[11px] text-cream/45 transition-colors hover:text-orange-500 sm:text-right"
        >
          view in your agents →
        </Link>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="delete agent?"
        message="this permanently deletes the agent and its history. this cannot be undone."
        confirmLabel="delete"
        confirmDanger
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
