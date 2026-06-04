import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center font-sans text-cream">
      <span className="font-mono text-xs text-orange-500">// 404</span>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
        not found.
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-cream/55">
        this page or agent does not exist.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/feed"
          className="rounded-md bg-orange-500 px-5 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-orange-600"
        >
          explore the feed
        </Link>
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
