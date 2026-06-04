"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserButton, useUser, useClerk } from "@clerk/nextjs";
import { baseHandle } from "@/lib/handle";

const MODES = [
  { id: "fast", label: "fast", desc: "quick answers, lowest latency" },
  { id: "smart", label: "smart", desc: "deeper reasoning for harder asks" },
  { id: "deep", label: "deep", desc: "long, thorough multi-step work" },
];

export default function SettingsPage() {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [mode, setMode] = useState("fast");

  useEffect(() => {
    const saved = window.localStorage.getItem("synapt:mode");
    if (saved && MODES.some((m) => m.id === saved)) setMode(saved);
  }, []);

  function pick(id: string) {
    setMode(id);
    try {
      window.localStorage.setItem("synapt:mode", id);
    } catch {
      // ignore
    }
  }

  const handle = user ? baseHandle(user.username, user.id) : "you";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const name = user?.fullName || handle;

  return (
    <main className="min-h-screen bg-background font-sans text-cream">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-cream/10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-5 py-3.5 sm:px-8">
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
              href="/chat"
              className="font-mono text-xs text-cream/55 transition-colors hover:text-cream"
            >
              chat
            </Link>
            <Link
              href="/feed"
              className="font-mono text-xs text-cream/55 transition-colors hover:text-cream"
            >
              explore
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[700px] px-5 py-10 sm:px-8 lg:py-14">
        <span className="font-mono text-xs text-orange-500">// settings</span>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          settings<span className="text-orange-500">.</span>
        </h1>
        <p className="mt-4 text-cream/60">your account and chat preferences.</p>

        {/* account */}
        <section className="mt-10">
          <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-cream/40">
            account
          </h2>
          <div className="mt-3 flex items-center gap-4 rounded-xl border border-cream/12 bg-background-pure p-5">
            <UserButton />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm text-cream">{name}</div>
              <div className="truncate font-mono text-xs text-cream/45">
                @{handle}
                {email ? ` · ${email}` : ""}
              </div>
            </div>
            <button
              onClick={() => openUserProfile()}
              className="shrink-0 rounded-md border border-cream/20 px-4 py-2 font-mono text-xs text-cream transition-colors hover:border-cream/50"
            >
              manage account
            </button>
          </div>
          <p className="mt-2 font-mono text-[11px] text-cream/35">
            change your handle, photo, or email in &ldquo;manage account&rdquo;.
          </p>
        </section>

        {/* chat preference */}
        <section className="mt-10">
          <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-cream/40">
            default chat mode
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => pick(m.id)}
                className={
                  "rounded-lg border p-4 text-left transition-colors " +
                  (mode === m.id
                    ? "border-orange-500/60 bg-orange-500/[0.06]"
                    : "border-cream/15 hover:border-cream/40")
                }
              >
                <div className="font-mono text-sm text-cream">{m.label}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-cream/50">
                  {m.desc}
                </p>
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-cream/35">
            sets the mode your chat opens in. you can still switch per chat.
          </p>
        </section>

        {/* sign out */}
        <section className="mt-12 border-t border-cream/10 pt-8">
          <button
            onClick={() => signOut()}
            className="rounded-md border border-red-500/40 px-5 py-2.5 font-mono text-sm text-red-400 transition-colors hover:bg-red-500/10"
          >
            sign out
          </button>
        </section>
      </div>
    </main>
  );
}
