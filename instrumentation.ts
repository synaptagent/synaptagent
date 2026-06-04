// Next.js runs register() once when the server boots. We use it to start the
// in-process background worker (Fase 4) that fires scheduled runs and drains the
// run queue. Node runtime only (never the edge runtime).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorker } = await import("@/lib/agent/worker");
    startWorker();
  }
}
