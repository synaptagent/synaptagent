import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { getAgentDetail } from "@/lib/data/agents";
import { getViewerId } from "@/lib/ensure-user";
import { ForkForm } from "./fork-form";

export const dynamic = "force-dynamic";

export default async function ForkPage({
  params,
}: {
  params: Promise<{ handle: string; name: string }>;
}) {
  const { handle: rawH, name: rawN } = await params;
  const handle = decodeURIComponent(rawH);
  const name = decodeURIComponent(rawN);

  const viewerId = await getViewerId();
  const detail = await getAgentDetail(handle, name, viewerId);

  return (
    <main className="min-h-screen bg-background font-sans text-cream">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-cream/10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[760px] items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/syntap.jpg" alt="SynaptAgent" className="h-7 w-auto rounded-md" />
            <span className="font-wordmark text-xl tracking-tight text-cream">
              SynaptAgent
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/feed" className="font-mono text-xs text-cream/55 transition-colors hover:text-cream">
              explore
            </Link>
            <Show when="signed-out">
              <Link href="/sign-up" className="rounded-md bg-orange-500 px-4 py-2 font-mono text-xs font-semibold text-black transition-colors hover:bg-orange-600">
                start free
              </Link>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[760px] px-5 py-10 sm:px-8 lg:py-14">
        <Link
          href={`/agent/${handle}/${name}`}
          className="font-mono text-xs text-cream/45 transition-colors hover:text-cream"
        >
          &larr; {handle}/{name}
        </Link>
        <span className="mt-5 block font-mono text-xs text-orange-500">// fork</span>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          fork <span className="italic text-orange-500">@{name}.</span>
        </h1>
        <p className="mt-4 max-w-lg text-cream/60">
          make your own version. set a goal, and it becomes yours, with a visible
          lineage back to the original.
        </p>

        {!detail ? (
          <div className="mt-12 rounded-xl border border-dashed border-cream/15 px-6 py-14 text-center">
            <p className="font-mono text-sm text-cream/55">agent not found.</p>
            <Link
              href="/feed"
              className="mt-5 inline-block rounded-md border border-cream/20 px-5 py-2.5 font-mono text-sm text-cream transition-colors hover:border-cream/50"
            >
              back to the feed →
            </Link>
          </div>
        ) : !viewerId ? (
          <div className="mt-12 rounded-xl border border-dashed border-cream/15 px-6 py-14 text-center">
            <p className="font-mono text-sm text-cream/55">sign in to fork this agent.</p>
            <Link
              href="/sign-in"
              className="mt-5 inline-block rounded-md bg-orange-500 px-5 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-orange-600"
            >
              sign in →
            </Link>
          </div>
        ) : (
          <ForkForm
            originalId={detail.id}
            originalRef={`${detail.view.ns}/${detail.view.name}`}
            defaultName={detail.view.name}
            defaultGoal={detail.view.desc}
            kind={detail.view.kind}
            kindColor={detail.view.kindColor}
          />
        )}
      </div>
    </main>
  );
}
