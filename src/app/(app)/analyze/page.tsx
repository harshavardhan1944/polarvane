import { PageHeader } from "@/components/NotBuiltYet";
import { createClient } from "@/lib/supabase/server";
import { AnalysisRow, type AnalysisRowData } from "./AnalysisRow";
import { NewAnalysisForm } from "./NewAnalysisForm";

export const instant = false;

export default async function AnalyzePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, post_url, shortcode, post_type, status, error_message, comments_collected, comment_limit, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const base = (data ?? []) as Omit<AnalysisRowData, "created_label" | "summary">[];

  // Real counts straight from the database for each finished analysis.
  const summaries = new Map<string, AnalysisRowData["summary"]>();
  await Promise.all(
    base
      .filter((r) => r.status === "completed")
      .map(async (r) => {
        const count = async (sentiment: string | null) => {
          let q = supabase.from("comments").select("id", { count: "exact", head: true }).eq("analysis_id", r.id);
          q = sentiment ? q.eq("sentiment", sentiment) : q.not("analysis_error", "is", null);
          const { count: c } = await q;
          return c ?? 0;
        };
        const [positive, neutral, negative, failed] = await Promise.all([
          count("positive"),
          count("neutral"),
          count("negative"),
          count(null),
        ]);
        summaries.set(r.id, { positive, neutral, negative, failed });
      }),
  );

  const rows: AnalysisRowData[] = base.map((r) => ({
    ...r,
    summary: summaries.get(r.id) ?? null,
    created_label: new Date(r.created_at).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }),
  }));
  const tableMissing = error && /does not exist|could not find the table/i.test(error.message);

  return (
    <>
      <PageHeader
        title="New analysis"
        subtitle="Paste a public Instagram post or Reel link to analyze its comments."
      />
      <NewAnalysisForm />

      <h2 className="mb-3 mt-8 text-sm font-medium text-muted">Your posts</h2>

      {error ? (
        <div className="panel p-5 text-sm text-red-200">
          {tableMissing
            ? "The database isn’t set up yet. Run the setup script in Supabase, then refresh this page."
            : "Couldn’t load your posts right now. Please refresh the page."}
        </div>
      ) : rows.length === 0 ? (
        <div className="panel p-6 text-center text-sm text-muted">No posts added yet.</div>
      ) : (
        <div className="panel divide-y divide-navy-700">
          {rows.map((r) => (
            <AnalysisRow key={r.id} row={r} />
          ))}
        </div>
      )}
    </>
  );
}
