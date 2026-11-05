import { PageHeader } from "@/components/NotBuiltYet";
import { computeInsights, keyInsights, loadComments, type CommentRow } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { DashboardEmpty, DashboardView } from "./DashboardView";

export const instant = false;

export default async function DashboardPage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const supabase = await createClient();

  // Load posts with their type; fall back if the post-type database update isn't applied yet.
  type A = { id: string; shortcode: string; post_type: string; post_kind?: string | null };
  const q = (cols: string) =>
    supabase.from("analyses").select(cols).eq("status", "completed").order("created_at", { ascending: false });
  let { data: analyses, error } = (await q("id, shortcode, post_type, post_kind")) as unknown as {
    data: A[] | null;
    error: { message: string } | null;
  };
  let hasKinds = true;
  if (error && /column|schema cache/i.test(error.message)) {
    hasKinds = false;
    ({ data: analyses, error } = (await q("id, shortcode, post_type")) as unknown as {
      data: A[] | null;
      error: { message: string } | null;
    });
  }

  const kind = sp.kind === "collaboration" || sp.kind === "brand" ? sp.kind : "";
  const all = (analyses ?? []).map((a) => ({
    id: a.id,
    kind: a.post_kind ?? "",
    label: `${a.post_type === "reel" ? "Reel" : "Post"} · ${a.shortcode}`,
  }));
  const counts = {
    all: all.length,
    collaboration: all.filter((p) => p.kind === "collaboration").length,
    brand: all.filter((p) => p.kind === "brand").length,
  };
  const posts = kind ? all.filter((p) => p.kind === kind) : all;
  const selected = typeof sp.post === "string" && posts.some((p) => p.id === sp.post) ? sp.post : "";

  if (error || all.length === 0) {
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
    const r = await loadComments(
      supabase,
      selected || undefined,
      !selected && kind ? posts.map((p) => p.id) : undefined,
    );
    rows = r.rows;
    if (r.truncated) notice = "Showing the first 20,000 comments. Pick a single post for its full results.";
  } catch (e) {
    console.error("[polarvane] dashboard load failed:", e);
    notice = "Couldn’t load all comments right now. Please refresh.";
  }
  const ins = computeInsights(rows);

  return (
    <DashboardView
      kind={kind}
      kindCounts={hasKinds ? counts : null}
      posts={posts}
      selected={selected}
      ins={ins}
      insights={keyInsights(ins)}
      postCount={selected ? 1 : posts.length}
      notice={notice}
    />
  );
}
