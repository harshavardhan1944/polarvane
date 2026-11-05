import { PageHeader } from "@/components/NotBuiltYet";
import { createClient } from "@/lib/supabase/server";
import { AnalysisRow, type AnalysisRowData } from "./AnalysisRow";
import { NewAnalysisForm } from "./NewAnalysisForm";

export const instant = false;
// Fetching post details can take up to ~2 minutes.
export const maxDuration = 300;

const BASE_COLS = "id, post_url, shortcode, post_type, status, error_message, comments_collected, comment_limit, created_at";
const DETAIL_COLS = "caption, post_owner, likes_count, views_count, comments_reported, post_published_at, details_status";

export default async function AnalyzePage() {
  const supabase = await createClient();
  // Load with post details; fall back gracefully if the details database update isn't applied yet.
  let hasDetails = true;
  const query = (cols: string) =>
    supabase.from("analyses").select(cols).order("created_at", { ascending: false }).limit(50);
  type Result = { data: Record<string, unknown>[] | null; error: { message: string } | null };
  let { data, error } = (await query(`${BASE_COLS}, ${DETAIL_COLS}`)) as unknown as Result;
  if (error && /column|schema cache/i.test(error.message)) {
    hasDetails = false;
    ({ data, error } = (await query(BASE_COLS)) as unknown as Result);
  }
  const base = (data ?? []) as unknown as Omit<AnalysisRowData, "created_label" | "summary" | "has_details">[];

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
    has_details: hasDetails,
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
