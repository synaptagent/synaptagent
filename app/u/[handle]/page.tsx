import Link from "next/link";
import { notFound } from "next/navigation";
import { Show, UserButton } from "@clerk/nextjs";
import { formatCount } from "@/lib/agents-mock";
import { AgentCard } from "@/components/agent-card";
import { getAgentsByUsername, userExists } from "@/lib/data/agents";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw);
  if (!(await userExists(handle))) notFound();
  const agents = await getAgentsByUsername(handle);

  const isOfficial = handle === "synaptagent";
  const display = isOfficial ? "synaptagent" : `@${handle}`;
  const totalStars = agents.reduce((s, a) => s + a.stars, 0);
  const totalForks = agents.reduce((s, a) => s + a.forks, 0);

  return (
    <main className="min-h-screen bg-background font-sans text-cream">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-cream/10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-3.5 sm:px-8">
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
          <nav className="hidden items-center gap-7 font-mono text-xs text-cream/55 md:flex">
            <Link href="/feed" className="transition-colors hover:text-cream">
              explore
            </Link>
            <Link href="/dashboard" className="transition-colors hover:text-cream">
              your agents
            </Link>
            <Link href="/chat" className="transition-colors hover:text-cream">
              chat
            </Link>
          </nav>
          <div className="flex items-center gap-3">
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

      <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 lg:py-14">
        <Link
          href="/feed"
          className="font-mono text-xs text-cream/45 transition-colors hover:text-cream"
        >
          &larr; the feed
        </Link>

        {/* identity */}
        <div className="mt-5 flex items-center gap-4 border-b border-cream/10 pb-8">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 font-wordmark text-3xl italic text-orange-500">
            {(handle.charAt(0) || "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 font-mono text-2xl text-cream sm:text-3xl">
              {display}
              {isOfficial && (
                <span className="rounded-full border border-orange-500/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-orange-500">
                  official
                </span>
              )}
            </h1>
            <p className="mt-1.5 font-mono text-xs text-cream/45">
              {agents.length} agent{agents.length === 1 ? "" : "s"} &middot;{" "}
              {formatCount(totalStars)} stars &middot; {formatCount(totalForks)}{" "}
              forks
            </p>
          </div>
        </div>

        {/* their agents */}
        {agents.length > 0 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <AgentCard key={`${a.ns}/${a.name}`} a={a} />
            ))}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="font-mono text-sm text-cream/55">
              no agents found for {display}.
            </p>
            <Link
              href="/feed"
              className="mt-5 inline-block rounded-md border border-cream/20 px-5 py-2.5 font-mono text-sm text-cream transition-colors hover:border-cream/50"
            >
              back to the feed →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
