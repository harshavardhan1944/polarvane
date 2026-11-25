import { PageHeader } from "@/components/NotBuiltYet";
import { listDashboards } from "@/lib/dashboards";
import { createClient } from "@/lib/supabase/server";
import type { CheckRow } from "./actions";
import { VisibilityTool } from "./VisibilityTool";

export const instant = false;

export default async function AiVisibilityPage() {
  const supabase = await createClient();
  const dashboards = (await listDashboards(supabase)) ?? [];

  let history: CheckRow[] = [];
  let setupNeeded = false;
  const { data, error } = await supabase
    .from("ai_visibility_checks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    setupNeeded = /does not exist|could not find the table|schema cache/i.test(error.message);
    if (!setupNeeded) console.error("[polarvane] load visibility checks failed:", error.message);
  } else {
    history = (data ?? []) as CheckRow[];
  }

  return (
    <>
      <PageHeader
        title="AI visibility"
        subtitle="Ask an AI assistant the questions your customers ask, and see whether it recommends your brand."
      />
      <VisibilityTool dashboards={dashboards} history={history} setupNeeded={setupNeeded} />
    </>
  );
}
