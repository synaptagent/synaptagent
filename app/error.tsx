"use client";

import Link from "next/link";

// Branded error boundary so a thrown server query (DB blip, etc.) shows our
// dark/editorial UI with a retry, instead of the default Next.js error screen.
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center font-sans text-cream">
      <span className="font-mono text-xs text-orange-500">// error</span>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        something broke.
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-cream/55">
        a hiccup on our end. try again in a moment.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-orange-500 px-5 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-orange-600"
        >
          try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-cream/20 px-5 py-2.5 font-mono text-sm text-cream transition-colors hover:border-cream/50"
        >
          go home
        </Link>
      </div>
    </main>
  );
}
