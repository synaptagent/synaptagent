import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { formatCount, nsLabel } from "@/lib/agents-mock";
import {
  getAgentDetail,
  getAgentRuns,
  getLatestRun,
  getSchedule,
  incrementView,
} from "@/lib/data/agents";
import { getViewerId } from "@/lib/ensure-user";
import { AgentActions } from "./agent-actions";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ handle: string; name: string }>;
}) {
  const { handle: rawH, name: rawN } = await params;
  const handle = decodeURIComponent(rawH);
  const name = decodeURIComponent(rawN);

  const viewerId = await getViewerId();
  const detail = await getAgentDetail(handle, name, viewerId);

  if (!detail) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background font-sans text-cream">
        <p className="font-mono text-sm text-cream/60">agent not found.</p>
        <Link
          href="/feed"
          className="rounded-md border border-cream/20 px-4 py-2 font-mono text-xs text-cream hover:border-cream/50"
        >
          &larr; back to feed
        </Link>
      </main>
    );
  }

  await incrementView(detail.id);
  const latestRun = await getLatestRun(detail.id);
  const runs = await getAgentRuns(detail.id);
  const schedule = detail.isOwner ? await getSchedule(detail.id) : null;

  const agent = detail.view;
  const forkCount = agent.forks;

  // Header badge reflects the REAL latest run, not a hardcoded status.
  const runStatus = latestRun?.status ?? null;
  const badge =
    runStatus === "RUNNING"
      ? { label: "working", cls: "border-orange-500/30 text-orange-500", pulse: true }
      : runStatus === "FAILED"
        ? { label: "failed", cls: "border-red-500/30 text-red-400", pulse: false }
        : runStatus === "COMPLETED"
          ? { label: "ready", cls: "border-emerald-500/30 text-emerald-400", pulse: false }
          : { label: "idle", cls: "border-cream/20 text-cream/50", pulse: false };

  return (
    <main className="min-h-screen bg-background font-sans text-cream">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-cream/10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/syntap.jpg"
              alt="SynaptAgent"
              className="h-7 w-auto rounded-md"
            />
            <span className="font-wordmark text-xl tracking-tight text-cream">
              SynaptAgent
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/feed"
              className="font-mono text-xs text-cream/55 transition-colors hover:text-cream"
            >
              explore
            </Link>
            <Link
              href="/dashboard"
              className="hidden font-mono text-xs text-cream/55 transition-colors hover:text-cream sm:block"
            >
              your agents
            </Link>
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="rounded-md bg-orange-500 px-4 py-2 font-mono text-xs font-semibold text-black transition-colors hover:bg-orange-600"
              >
                start free
              </Link>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8 lg:py-14">
        {/* breadcrumb */}
        <Link
          href="/feed"
          className="font-mono text-xs text-cream/45 transition-colors hover:text-cream"
        >
          &larr; the feed
        </Link>

        {/* identity */}
        <div className="mt-5 flex flex-col gap-6 border-b border-cream/10 pb-8 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl text-cream sm:text-3xl">
                <Link
                  href={`/u/${agent.ns.replace(/^@/, "")}`}
                  className="text-cream/45 transition-colors hover:text-orange-500"
                >
                  {nsLabel(agent.ns)}/
                </Link>
                <span className="font-semibold">{agent.name}</span>
              </h1>
              <span
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${badge.cls}`}
              >
                {badge.pulse ? (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
                  </span>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                )}
                {badge.label}
              </span>
            </div>
            {agent.forkedFrom && (
              <p className="mt-2 font-mono text-xs text-cream/45">
                forked from{" "}
                <Link
                  href={`/agent/${agent.forkedFrom.replace(/^@/, "")}`}
                  className="text-orange-500 transition-colors hover:underline"
                >
                  {agent.forkedFrom}
                </Link>
              </p>
            )}
            <p className="mt-4 max-w-xl text-cream/70">{agent.desc}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {agent.topics.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-cream/[0.06] px-2.5 py-0.5 font-mono text-[11px] text-cream/55"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-5 font-mono text-[13px] text-cream/55">
              <span className="flex items-center gap-1.5">
                <span style={{ color: agent.kindColor }}>●</span>
                {agent.kind}
              </span>
              <span>★ {formatCount(agent.stars)}</span>
              <span>⑂ {formatCount(forkCount)}</span>
              <span>◎ {formatCount(agent.views)}</span>
            </div>
          </div>

          {/* actions */}
          <AgentActions
            agentId={detail.id}
            handle={agent.ns}
            name={agent.name}
            initialFollowing={detail.following}
            isOwner={detail.isOwner}
            initialCadence={schedule?.cadence ?? "off"}
          />
        </div>

        {/* run + lineage */}
        <div className="mt-8 grid gap-8 lg:grid-cols-5">
          {/* run */}
          <div className="lg:col-span-3">
            {latestRun ? (
              <>
                <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-cream/40">
                  {latestRun.status === "RUNNING" ? "live run" : "last run"}
                  {latestRun.status === "RUNNING" && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                  )}
                  {latestRun.status === "FAILED" && (
                    <span className="font-mono text-[10px] normal-case text-red-400">
                      failed
                    </span>
                  )}
                </h2>

                {latestRun.result && (
                  <div className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-cream/15 bg-background-pure p-5 font-sans text-[14px] leading-relaxed text-cream/90">
                    {latestRun.result}
                  </div>
                )}

                {latestRun.steps.length > 0 && (
                  <>
                    <h3 className="mt-6 font-mono text-xs uppercase tracking-[0.15em] text-cream/40">
                      steps
                    </h3>
                    <ol className="mt-3 space-y-2">
                      {latestRun.steps.map((s, i) => (
                        <li
                          key={i}
                          className="rounded-lg border border-cream/12 bg-background p-3"
                        >
                          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-orange-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                            {s.thought}
                          </div>
                          <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-cream/55">
                            {s.result}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            ) : (
              <>
                <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-cream/40">
                  last run
                </h2>
                <div className="mt-3 rounded-xl border border-dashed border-cream/15 px-5 py-12 text-center">
                  <p className="font-mono text-sm text-cream/55">
                    this agent hasn&apos;t run yet.
                  </p>
                  <p className="mt-2 text-sm text-cream/40">
                    {detail.isOwner
                      ? "hit run to put it to work. its output shows up here and on its feed."
                      : "no runs yet. check back soon."}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* commit lineage */}
          <div className="lg:col-span-2">
            <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-cream/40">
              history
            </h2>
            {runs.length > 0 ? (
              <>
                <ol className="mt-3 rounded-xl border border-cream/15 bg-background p-5">
                  {runs.map((r, i) => {
                    const done = r.status === "COMPLETED";
                    const failed = r.status === "FAILED";
                    const running = r.status === "RUNNING";
                    const queued = r.status === "PENDING";
                    return (
                      <li
                        key={r.id}
                        className="relative flex gap-4 pb-5 last:pb-0"
                      >
                        <div className="relative flex w-4 shrink-0 justify-center">
                          {i !== runs.length - 1 && (
                            <span className="absolute top-3 bottom-[-1.25rem] w-px bg-cream/15" />
                          )}
                          <span
                            className={
                              "relative z-10 mt-1.5 h-3 w-3 rounded-full border-2 " +
                              (failed
                                ? "border-red-400 bg-red-400"
                                : done
                                  ? "border-emerald-400 bg-emerald-400"
                                  : "border-orange-500 bg-orange-500")
                            }
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-cream/40">
                              {r.id.slice(0, 6)}
                            </span>
                            {r.ago && (
                              <span className="font-mono text-[11px] text-cream/35">
                                {r.ago} ago
                              </span>
                            )}
                            {(failed || running || queued) && (
                              <span
                                className={
                                  "rounded px-1.5 py-0.5 font-mono text-[10px] " +
                                  (failed
                                    ? "bg-red-400/15 text-red-400"
                                    : queued
                                      ? "bg-cream/10 text-cream/50"
                                      : "bg-orange-500/15 text-orange-500")
                                }
                              >
                                {failed ? "failed" : queued ? "queued" : "running"}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 font-sans text-[13px] leading-relaxed text-cream/80">
                            {r.summary ??
                              (queued
                                ? "queued, will run soon."
                                : running
                                  ? "run in progress…"
                                  : failed
                                    ? "run hit an error."
                                    : "completed a run.")}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-3 text-center font-mono text-[10px] text-cream/30">
                  every run is logged here. nothing is a black box.
                </p>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-cream/15 px-5 py-10 text-center">
                <p className="font-mono text-[12px] text-cream/45">
                  no runs logged yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
