import Link from "next/link";
import { PageHeader } from "@/components/NotBuiltYet";
import { DashboardSwitcher } from "@/components/DashboardSwitcher";
import { listDashboards } from "@/lib/dashboards";
import { loadQuestions } from "@/lib/replies";
import { createClient } from "@/lib/supabase/server";
import { ReplyHelper } from "./ReplyHelper";

export const instant = false;

export default async function ReplyHelperPage(props: PageProps<"/reply-helper">) {
  const sp = await props.searchParams;
  const supabase = await createClient();
  const dashboards = await listDashboards(supabase);
  const current = typeof sp.d === "string" && dashboards?.some((d) => d.id === sp.d) ? sp.d : "";
  const currentName = dashboards?.find((d) => d.id === current)?.name ?? "";

  let q = supabase.from("analyses").select("id").eq("status", "completed");
  if (current) q = q.eq("dashboard_id", current);
  const { data: posts } = await q.order("created_at", { ascending: false }).limit(50);
  const ids = (posts ?? []).map((p) => p.id as string);

  const header = (
    <PageHeader
      title="Reply helper"
      subtitle="Customer questions in your comments that nobody has answered yet, with a draft reply for each."
    />
  );
  const switcher = <DashboardSwitcher dashboards={dashboards} current={current} basePath="/reply-helper" />;

  if (ids.length === 0) {
    return (
      <>
        {header}
        {switcher}
        <div className="panel p-6 text-sm text-muted">
          {currentName ? `“${currentName}” has no analyzed posts yet. ` : "No analyzed posts yet. "}
          <Link href={`/analyze${current ? `?d=${current}` : ""}`} className="text-brand-blue hover:underline">
            Analyze a post first
          </Link>
          .
        </div>
      </>
    );
  }

  const questions = await loadQuestions(supabase, ids);
  const stats = {
    posts: ids.length,
    questions: questions.length,
    noReply: questions.filter((r) => r.replies === 0).length,
    unknown: questions.filter((r) => r.replies === null).length,
  };

  return (
    <>
      {header}
      {switcher}
      <ReplyHelper key={current} dashboardId={current} stats={stats} />
    </>
  );
}
