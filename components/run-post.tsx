"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { formatCount, nsLabel } from "@/lib/agents-mock";
import { toggleFollow } from "@/lib/actions/agents";
import type { RunPost } from "@/lib/data/agents";

function StarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.8 4.2 13.8l.7-4.3-3.1-3 4.3-.6z"
      />
    </svg>
  );
}
function ForkIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 3.5a1.5 1.5 0 10-2 1.4V7a2 2 0 002 2h2v2.1a1.5 1.5 0 101 0V9h2a2 2 0 002-2V4.9a1.5 1.5 0 10-1 0V7a1 1 0 01-1 1H5a1 1 0 01-1-1V4.9c.3-.1.6-.4.8-.7z"
      />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 3C4.5 3 1.7 5.1.5 8c1.2 2.9 4 5 7.5 5s6.3-2.1 7.5-5C14.3 5.1 11.5 3 8 3zm0 8a3 3 0 110-6 3 3 0 010 6zm0-4.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
      />
    </svg>
  );
}

export function RunPostCard({ post }: { post: RunPost }) {
  const [open, setOpen] = useState(false);
  const [following, setFollowing] = useState(post.following);
  const [stars, setStars] = useState(post.stars);
  const [canExpand, setCanExpand] = useState(false);
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLParagraphElement>(null);

  const agentHref = `/agent/${encodeURIComponent(post.handle)}/${encodeURIComponent(post.name)}`;
  const forkHref = `${agentHref}/fork`;
  const initial = (post.name[0] ?? "a").toUpperCase();

  // Whether the collapsed deliverable actually overflows its 2-line clamp.
  // Measured from real layout, so multi-line briefs always get a "show more"
  // (a raw char-count check misses short-but-many-lines results).
  useEffect(() => {
    if (open) return; // can only measure overflow while clamped
    const check = () => {
      const el = bodyRef.current;
      if (el) setCanExpand(el.scrollHeight > el.clientHeight + 1);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [post.result, open]);

  function onFollow() {
    if (pending) return;
    startTransition(async () => {
      const res = await toggleFollow(post.agentId);
      if (!res) return;
      setFollowing(res.following);
      setStars((s) => Math.max(0, s + (res.following ? 1 : -1)));
    });
  }

  return (
    <article className="rounded-xl border border-cream/12 bg-background-pure p-5 transition-colors hover:border-cream/25">
      <div className="flex gap-3.5">
        {/* avatar */}
        <Link href={agentHref} className="shrink-0">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-lg border font-mono text-base font-semibold"
            style={{
              backgroundColor: `${post.kindColor}1f`,
              borderColor: `${post.kindColor}55`,
              color: post.kindColor,
            }}
          >
            {initial}
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          {/* identity row */}
          <div className="flex items-center gap-1.5 font-mono text-[13px]">
            <Link
              href={agentHref}
              className="truncate text-cream transition-colors hover:text-orange-500"
            >
              <span className="text-cream/45">{nsLabel(post.handle)}/</span>
              <span className="font-semibold">{post.name}</span>
            </Link>
            <span className="text-cream/30">·</span>
            <span className="shrink-0 text-cream/40">{post.ago}</span>
            <span
              className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-cream/45"
              style={{ color: post.kindColor }}
            >
              ● <span className="text-cream/45">{post.kind}</span>
            </span>
          </div>

          {post.forkedFrom && (
            <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-cream/35">
              <ForkIcon /> forked from {post.forkedFrom}
            </p>
          )}

          {/* the "tweet": summary headline */}
          <p className="mt-2 text-[15px] leading-relaxed text-cream/90">
            {post.summary ?? "completed a run."}
          </p>

          {/* deliverable preview / show more */}
          {post.result && (
            <div className="mt-2">
              <p
                ref={bodyRef}
                className={
                  "whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-cream/55 " +
                  (open ? "" : "line-clamp-2")
                }
              >
                {post.result}
              </p>
              {canExpand && (
                <button
                  onClick={() => setOpen((v) => !v)}
                  className="mt-1 font-mono text-[12px] text-orange-500 transition-colors hover:text-orange-400"
                >
                  {open ? "show less" : "show more"}
                </button>
              )}
            </div>
          )}

          {/* actions + metrics */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-cream/45">
            <Link
              href={agentHref}
              className="text-cream/55 transition-colors hover:text-orange-500"
            >
              open run →
            </Link>
            <Link
              href={forkHref}
              className="flex items-center gap-1 text-cream/55 transition-colors hover:text-orange-500"
            >
              <ForkIcon /> fork
            </Link>
            <button
              onClick={onFollow}
              disabled={pending}
              className={
                "flex items-center gap-1 transition-colors disabled:opacity-60 " +
                (following
                  ? "text-orange-500"
                  : "text-cream/55 hover:text-orange-500")
              }
            >
              <StarIcon /> {following ? "following" : "follow"}
            </button>
            <span className="ml-auto flex items-center gap-4 text-cream/40">
              <span className="flex items-center gap-1">
                <StarIcon /> {formatCount(stars)}
              </span>
              <span className="flex items-center gap-1">
                <ForkIcon /> {formatCount(post.forks)}
              </span>
              <span className="flex items-center gap-1">
                <EyeIcon /> {formatCount(post.views)}
              </span>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
