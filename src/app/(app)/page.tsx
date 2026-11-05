import { DashboardSwitcher } from "@/components/DashboardSwitcher";
import { listDashboards } from "@/lib/dashboards";
import { computeInsights, keyInsights, loadComments, type CommentRow } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { DashboardEmpty, DashboardView } from "./DashboardView";

export const instant = false;

export default async function DashboardPage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const supabase = await createClient();

  const dashboards = await listDashboards(supabase);
  const current =
    typeof sp.d === "string" && dashboards?.some((d) => d.id === sp.d) ? sp.d : "";
  const currentName = dashboards?.find((d) => d.id === current)?.name ?? "";

  // Completed posts, with their dashboard (falls back if the dashboards update isn't applied).
  type A = { id: string; shortcode: string; post_type: string; dashboard_id?: string | null };
  const q = (cols: string) =>
    supabase.from("analyses").select(cols).eq("status", "completed").order("created_at", { ascending: false });
  type R = { data: A[] | null; error: { message: string } | null };
  let { data: analyses, error } = (await q("id, shortcode, post_type, dashboard_id")) as unknown as R;
  if (error && /column|schema cache/i.test(error.message)) {
    ({ data: analyses, error } = (await q("id, shortcode, post_type")) as unknown as R);
  }

  const posts = (analyses ?? [])
    .filter((a) => !current || a.dashboard_id === current)
    .map((a) => ({ id: a.id, label: `${a.post_type === "reel" ? "Reel" : "Post"} · ${a.shortcode}` }));
  const selected = typeof sp.post === "string" && posts.some((p) => p.id === sp.post) ? sp.post : "";

  const switcher = <DashboardSwitcher dashboards={dashboards} current={current} />;

  if (error || posts.length === 0) {
    return (
      <>
        {switcher}
        <DashboardEmpty failed={Boolean(error)} dashboardId={current} dashboardName={currentName} />
      </>
    );
  }

  let rows: CommentRow[] = [];
  let notice: string | null = null;
  try {
    const r = await loadComments(
      supabase,
      selected || undefined,
      !selected && current ? posts.map((p) => p.id) : undefined,
    );
    rows = r.rows;
    if (r.truncated) notice = "Showing the first 20,000 comments. Pick a single post for its full results.";
  } catch (e) {
    console.error("[polarvane] dashboard load failed:", e);
    notice = "Couldn’t load all comments right now. Please refresh.";
  }
  const ins = computeInsights(rows);

  return (
    <>
      {switcher}
      <DashboardView
        dashboardId={current}
        dashboardName={currentName}
        posts={posts}
        selected={selected}
        ins={ins}
        insights={keyInsights(ins)}
        postCount={selected ? 1 : posts.length}
        notice={notice}
      />
    </>
  );
}
