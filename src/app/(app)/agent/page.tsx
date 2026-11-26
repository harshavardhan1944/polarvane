import { PageHeader } from "@/components/NotBuiltYet";
import { listDashboards } from "@/lib/dashboards";
import { createClient } from "@/lib/supabase/server";
import { AgentRunner } from "./AgentRunner";

export const instant = false;
// Each step can wait on the AI service; allow the longest time Vercel permits.
export const maxDuration = 300;

export default async function AgentPage() {
  const supabase = await createClient();
  const dashboards = (await listDashboards(supabase)) ?? [];
  return (
    <>
      <PageHeader
        title="Polarvane agent"
        subtitle="Give it a goal. It decides which Polarvane tools to run on your comments, step by step, and writes one plan. It only reads and suggests; it never posts."
      />
      <AgentRunner dashboards={dashboards} />
    </>
  );
}
