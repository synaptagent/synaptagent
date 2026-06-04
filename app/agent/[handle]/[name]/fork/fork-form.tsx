"use client";

import { useState, useTransition } from "react";
import { useUser } from "@clerk/nextjs";
import { forkAgent } from "@/lib/actions/agents";
import { baseHandle } from "@/lib/handle";

export function ForkForm({
  originalId,
  originalRef,
  defaultName,
  defaultGoal,
  kind,
  kindColor,
}: {
  originalId: string;
  originalRef: string;
  defaultName: string;
  defaultGoal: string;
  kind: string;
  kindColor: string;
}) {
  const { user } = useUser();
  const handle = user ? baseHandle(user.username, user.id) : "you";

  const [name, setName] = useState(defaultName);
  const [goal, setGoal] = useState(defaultGoal);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const valid = slug.length >= 2 && goal.trim().length >= 5;

  function submit() {
    if (!valid || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await forkAgent({ originalAgentId: originalId, name, goal });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="mt-8 space-y-8">
      {/* forked from */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cream/12 bg-background-pure px-4 py-3 font-mono text-xs text-cream/55">
        <span style={{ color: kindColor }}>●</span>
        forked from <span className="text-cream">{originalRef}</span>
        <span className="text-cream/30">&middot;</span>
        {kind}
      </div>

      {/* name */}
      <div>
        <label className="font-mono text-xs uppercase tracking-[0.15em] text-cream/40">
          1 &middot; name your fork
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="e.g. crypto-digest"
          className="mt-3 w-full rounded-lg border border-cream/15 bg-background-pure px-4 py-3 font-mono text-sm text-cream placeholder:text-cream/30 focus:border-cream/40 focus:outline-none"
        />
        {slug && (
          <p className="mt-2 font-mono text-[11px] text-cream/40">
            handle: <span className="text-orange-500">@{handle}/{slug}</span>
            <span className="text-cream/25"> &middot; if taken, a number is added</span>
          </p>
        )}
      </div>

      {/* goal */}
      <div>
        <label className="font-mono text-xs uppercase tracking-[0.15em] text-cream/40">
          2 &middot; give it YOUR goal
        </label>
        <p className="mt-1.5 text-xs leading-relaxed text-cream/40">
          prefilled from the original. change it to make this fork different, or
          keep it to make an exact copy.
        </p>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          maxLength={600}
          rows={3}
          placeholder="what should YOUR version do?"
          className="mt-3 w-full resize-none rounded-lg border border-cream/15 bg-background-pure px-4 py-3 text-sm leading-relaxed text-cream placeholder:text-cream/30 focus:border-cream/40 focus:outline-none"
        />
      </div>

      {/* submit */}
      <div className="flex items-center gap-4">
        <button
          onClick={submit}
          disabled={!valid || pending}
          className="rounded-md bg-orange-500 px-7 py-3 font-mono text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "forking…" : "create fork →"}
        </button>
        <span className="font-mono text-[11px] text-cream/35">
          your fork, under your handle. free.
        </span>
      </div>
      {error && (
        <p className="font-mono text-[12px] text-orange-500">{error}</p>
      )}
    </div>
  );
}
