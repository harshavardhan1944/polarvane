import { PageHeader } from "@/components/NotBuiltYet";
import { computeInsights, keyInsights, loadComments, type CommentRow } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { DashboardEmpty, DashboardView } from "./DashboardView";

export const instant = false;

export default async function DashboardPage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const supabase = await createClient();

  const { data: analyses, error } = await supabase
    .from("analyses")
    .select("id, shortcode, post_type")
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const posts = (analyses ?? []).map((a) => ({
    id: a.id as string,
    label: `${a.post_type === "reel" ? "Reel" : "Post"} · ${a.shortcode}`,
  }));
  const selected = typeof sp.post === "string" && posts.some((p) => p.id === sp.post) ? sp.post : "";

  if (error || posts.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Audience sentiment and topics across the Instagram posts you analyze." />
        <DashboardEmpty failed={Boolean(error)} />
      </>
    );
  }

  let rows: CommentRow[] = [];
  let notice: string | null = null;
  try {
    const r = await loadComments(supabase, selected || undefined);
    rows = r.rows;
    if (r.truncated) notice = "Showing the first 20,000 comments. Pick a single post for its full results.";
  } catch (e) {
    console.error("[polarvane] dashboard load failed:", e);
    notice = "Couldn’t load all comments right now. Please refresh.";
  }
  const ins = computeInsights(rows);

  return (
    <DashboardView
      posts={posts}
      selected={selected}
      ins={ins}
      insights={keyInsights(ins)}
      postCount={selected ? 1 : posts.length}
      notice={notice}
    />
  );
}
