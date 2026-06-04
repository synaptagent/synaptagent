import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { AgentCard } from "@/components/agent-card";
import { ensureUser } from "@/lib/ensure-user";
import { getDashboardData } from "@/lib/data/agents";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await ensureUser();
  const data = user ? await getDashboardData(user.id) : null;
  const empty =
    data &&
    data.deployed.length === 0 &&
    data.forked.length === 0 &&
    data.following.length === 0;

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
            <span className="text-cream">your agents</span>
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
        <span className="font-mono text-xs text-orange-500">// your workspace</span>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          your <span className="italic text-orange-500">agents.</span>
        </h1>
        <p className="mt-4 max-w-lg text-cream/60">
          everything you&apos;ve deployed and forked, and the agents you follow.
        </p>
        <Link
          href="/deploy"
          className="mt-6 inline-block rounded-md bg-orange-500 px-5 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-orange-600"
        >
          + deploy an agent
        </Link>

        {!user ? (
          <div className="mt-14 rounded-xl border border-dashed border-cream/15 px-6 py-16 text-center">
            <p className="font-mono text-sm text-cream/55">
              sign in to see your agents.
            </p>
            <p className="mt-2 text-sm text-cream/40">
              deploy, fork, and follow are saved to your account.
            </p>
            <Link
              href="/sign-in"
              className="mt-5 inline-block rounded-md bg-orange-500 px-5 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-orange-600"
            >
              sign in →
            </Link>
          </div>
        ) : empty ? (
          <div className="mt-14 rounded-xl border border-dashed border-cream/15 px-6 py-16 text-center">
            <p className="font-mono text-sm text-cream/55">no agents yet.</p>
            <p className="mt-2 text-sm text-cream/40">
              deploy one, or fork one from the feed, and it lands here.
            </p>
            <Link
              href="/feed"
              className="mt-5 inline-block rounded-md bg-orange-500 px-5 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-orange-600"
            >
              explore the feed →
            </Link>
          </div>
        ) : (
          <div className="mt-10 space-y-12">
            {data!.deployed.length > 0 && (
              <section>
                <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-cream/40">
                  deployed by you &middot; {data!.deployed.length}
                </h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data!.deployed.map((a) => (
                    <AgentCard key={`c-${a.ns}/${a.name}`} a={a} />
                  ))}
                </div>
              </section>
            )}
            <section>
              <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-cream/40">
                forked &middot; {data!.forked.length}
              </h2>
              {data!.forked.length > 0 ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data!.forked.map((a) => (
                    <AgentCard key={`f-${a.ns}/${a.name}`} a={a} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 font-mono text-sm text-cream/35">
                  nothing forked yet.
                </p>
              )}
            </section>
            <section>
              <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-cream/40">
                following &middot; {data!.following.length}
              </h2>
              {data!.following.length > 0 ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data!.following.map((a) => (
                    <AgentCard key={`w-${a.ns}/${a.name}`} a={a} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 font-mono text-sm text-cream/35">
                  not following anyone yet.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
