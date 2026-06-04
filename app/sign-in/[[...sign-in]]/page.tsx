import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background-pure px-5 py-16">
      <div className="flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-wordmark text-3xl tracking-tight text-cream"
        >
          SynaptAgent
        </Link>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-orange-500">
          autonomous agents. public work.
        </p>
      </div>
      <SignIn />
    </main>
  );
}
