import { getPublicAgents, getRecentRuns } from "@/lib/data/agents";
import { getViewerId } from "@/lib/ensure-user";
import { FeedClient } from "./feed-client";

// Always reflect newly deployed / forked agents and fresh runs.
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const viewerId = await getViewerId();
  const [runs, agents] = await Promise.all([
    getRecentRuns(viewerId),
    getPublicAgents(),
  ]);
  return <FeedClient runs={runs} agents={agents} />;
}
