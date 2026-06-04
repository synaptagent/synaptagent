// Shared branded loading screen for data pages (force-dynamic + remote DB) so
// navigation gives immediate feedback instead of a blank/frozen page.
export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-2.5 font-mono text-sm text-cream/45">
        <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
        loading…
      </div>
    </main>
  );
}
