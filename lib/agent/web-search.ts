import "server-only";

// Web search via Tavily (free tier: ~1000 searches/month). The agent uses this
// to ground its work in REAL, current sources instead of static LLM memory, so
// each run reflects what is actually out there (and can cite it).
//
// Fully optional: with no TAVILY_API_KEY set, hasWebSearch() is false and the
// engine simply skips the research phase (runs LLM-only, as before).

export type WebResult = {
  title: string;
  url: string;
  content: string;
  raw: string; // full cleaned page content (for deep reading), falls back to snippet
};

export function hasWebSearch(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function webSearch(
  query: string,
  maxResults = 5,
): Promise<WebResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !query.trim()) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: query.slice(0, 380),
        max_results: maxResults,
        search_depth: "basic",
        include_raw_content: true, // full page text, not just a snippet
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const results =
      data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)
        ? ((data as { results: unknown[] }).results as Record<string, unknown>[])
        : [];
    return results
      .map((r) => ({
        title: String(r.title ?? ""),
        url: String(r.url ?? ""),
        content: String(r.content ?? ""),
        raw: String(r.raw_content ?? r.content ?? ""),
      }))
      .filter((r) => r.url);
  } catch {
    return [];
  }
}

/** Read the full cleaned content of a specific URL (Tavily extract). "" on fail. */
export async function readUrl(url: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !/^https?:\/\//i.test(url)) return "";
  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, urls: [url] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return "";
    const data: unknown = await res.json();
    const results =
      data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)
        ? ((data as { results: Record<string, unknown>[] }).results)
        : [];
    const first = results[0];
    return first ? String(first.raw_content ?? first.content ?? "") : "";
  } catch {
    return "";
  }
}
