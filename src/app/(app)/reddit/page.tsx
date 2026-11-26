import Link from "next/link";
import { PageHeader } from "@/components/NotBuiltYet";
import { DashboardSwitcher } from "@/components/DashboardSwitcher";
import { listDashboards, loadPostTitles, postLabel } from "@/lib/dashboards";
import { computeInsights, keyInsights, loadComments, type CommentRow } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { DashboardView } from "../DashboardView";

export const instant = false;

// Reddit dashboard: sentiment and topics from Reddit threads only.
export default async function RedditDashboardPage(props: PageProps<"/reddit">) {
  const sp = await props.searchParams;
  const supabase = await createClient();
  const dashboards = await listDashboards(supabase);
  const current = typeof sp.d === "string" && dashboards?.some((d) => d.id === sp.d) ? sp.d : "";
  const currentName = dashboards?.find((d) => d.id === current)?.name ?? "";

  type A = { id: string; shortcode: string; post_type: string; dashboard_id?: string | null };
  type R = { data: A[] | null; error: { message: string } | null };
  const q = (cols: string) =>
    supabase
      .from("analyses")
      .select(cols)
      .eq("status", "completed")
      .eq("post_type", "reddit")
      .order("created_at", { ascending: false });
  let { data: analyses, error } = (await q("id, shortcode, post_type, dashboard_id")) as unknown as R;
  if (error && /column|schema cache/i.test(error.message)) ({ data: analyses, error } = (await q("id, shortcode, post_type")) as unknown as R);

  const titles = await loadPostTitles(supabase);
  const posts = (analyses ?? [])
    .filter((a) => !current || a.dashboard_id === current)
    .map((a) => ({ id: a.id, label: postLabel(a, titles) }));
  const selected = typeof sp.post === "string" && posts.some((p) => p.id === sp.post) ? sp.post : "";
  const addHref = `/reddit/add${current ? `?d=${current}` : ""}`;
  const switcher = <DashboardSwitcher dashboards={dashboards} current={current} basePath="/reddit" />;

  if (error || posts.length === 0) {
    return (
      <>
        <PageHeader title="Reddit dashboard" subtitle="What Reddit says about the brand: sentiment and topics from Reddit threads only." />
        {switcher}
        <div className="panel p-6 text-sm text-muted">
          {error
            ? "Couldn’t load Reddit threads right now. Please refresh."
            : `No analyzed Reddit threads${currentName ? ` in “${currentName}”` : ""} yet. `}
          {!error && (
            <Link href={addHref} className="text-brand-blue hover:underline">
              Add Reddit threads
            </Link>
          )}
        </div>
      </>
    );
  }

  let rows: CommentRow[] = [];
  let notice: string | null = null;
  try {
    const r = await loadComments(supabase, selected || undefined, selected ? undefined : posts.map((p) => p.id));
    rows = r.rows;
    if (r.truncated) notice = "Showing the first 20,000 comments. Pick a single thread for its full results.";
  } catch (e) {
    console.error("[polarvane] reddit dashboard load failed:", e);
    notice = "Couldn’t load all comments right now. Please refresh.";
  }
  const ins = computeInsights(rows);

  return (
    <>
      <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs text-orange-200">
        Reddit only
      </p>
      {switcher}
      <DashboardView
        dashboardId={current}
        dashboardName={currentName ? `Reddit · ${currentName}` : "All Reddit threads"}
        posts={posts}
        selected={selected}
        ins={ins}
        insights={keyInsights(ins)}
        postCount={selected ? 1 : posts.length}
        notice={notice}
        basePath="/reddit"
        talonPath="/reddit/talon"
        addHref={addHref}
        unit="thread"
      />
    </>
  );
}
