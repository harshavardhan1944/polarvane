import Link from "next/link";
import { PageHeader } from "@/components/NotBuiltYet";
import { DashboardSwitcher } from "@/components/DashboardSwitcher";
import { computeSignals, MIN_COMMENTS } from "@/lib/adbrief";
import { listDashboards, loadPostTitles, postLabel } from "@/lib/dashboards";
import { loadComments } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { AdRecommendations, type PostCard } from "./AdRecommendations";

export const instant = false;

export default async function AdRecommendationsPage(props: PageProps<"/ad-recommendations">) {
  const sp = await props.searchParams;
  const supabase = await createClient();
  const dashboards = await listDashboards(supabase);
  const current = typeof sp.d === "string" && dashboards?.some((d) => d.id === sp.d) ? sp.d : "";
  const currentName = dashboards?.find((d) => d.id === current)?.name ?? "";

  type A = {
    id: string;
    shortcode: string;
    post_type: string;
    dashboard_id?: string | null;
    views_count?: number | null;
    likes_count?: number | null;
  };
  type R = { data: A[] | null; error: { message: string } | null };
  const pq = (cols: string) =>
    supabase.from("analyses").select(cols).eq("status", "completed").order("created_at", { ascending: false });
  let res = (await pq("id, shortcode, post_type, dashboard_id, views_count, likes_count")) as unknown as R;
  if (res.error) res = (await pq("id, shortcode, post_type")) as unknown as R;
  const titles = await loadPostTitles(supabase);
  const analyses = (res.data ?? []).filter((a) => !current || a.dashboard_id === current);

  const switcher = <DashboardSwitcher dashboards={dashboards} current={current} basePath="/ad-recommendations" />;
  const header = (
    <PageHeader
      title="Ad recommendations"
      subtitle="Which posts show the strongest product interest to test as paid ads, and an ad brief written from real comments."
    />
  );

  if (analyses.length === 0) {
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

  const { rows } = await loadComments(supabase, undefined, analyses.map((a) => a.id));
  const signals = computeSignals(
    analyses.map((a) => a.id),
    rows,
  );
  const posts: PostCard[] = analyses
    .map((a) => {
      const s = signals.find((x) => x.id === a.id)!;
      return {
        ...s,
        label: postLabel(a, titles),
        views: a.views_count ?? null,
        likes: a.likes_count ?? null,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <>
      {header}
      {switcher}
      <AdRecommendations key={current} posts={posts} minComments={MIN_COMMENTS} />
    </>
  );
}
