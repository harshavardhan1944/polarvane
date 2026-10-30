import { Clapperboard, ExternalLink, ImageIcon, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/NotBuiltYet";
import { createClient } from "@/lib/supabase/server";
import { deleteAnalysis } from "./actions";
import { NewAnalysisForm } from "./NewAnalysisForm";

export const instant = false;

type AnalysisRow = {
  id: string;
  post_url: string;
  shortcode: string;
  post_type: "post" | "reel";
  status: "queued" | "collecting" | "analyzing" | "completed" | "failed";
  error_message: string | null;
  comments_collected: number;
  created_at: string;
};

const STATUS_LABEL: Record<AnalysisRow["status"], { label: string; cls: string }> = {
  queued: { label: "Saved · collection not built yet", cls: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
  collecting: { label: "Collecting comments", cls: "border-brand-blue/30 bg-brand-blue/10 text-blue-200" },
  analyzing: { label: "Analyzing", cls: "border-brand-violet/30 bg-brand-violet/10 text-violet-200" },
  completed: { label: "Completed", cls: "border-positive/30 bg-positive/10 text-emerald-200" },
  failed: { label: "Failed", cls: "border-negative/30 bg-negative/10 text-red-200" },
};

export default async function AnalyzePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, post_url, shortcode, post_type, status, error_message, comments_collected, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as AnalysisRow[];
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
          {rows.map((r) => {
            const s = STATUS_LABEL[r.status];
            const Icon = r.post_type === "reel" ? Clapperboard : ImageIcon;
            return (
              <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-700/70">
                    <Icon size={16} className="text-brand-blue" />
                  </div>
                  <div className="min-w-0">
                    <a
                      href={r.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 truncate text-sm hover:text-brand-blue"
                    >
                      {r.post_type === "reel" ? "Reel" : "Post"} · {r.shortcode}
                      <ExternalLink size={12} className="shrink-0 text-faint" />
                    </a>
                    <p className="text-xs text-faint">
                      Added{" "}
                      {new Date(r.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kolkata",
                      })}
                      {r.status === "failed" && r.error_message ? ` · ${r.error_message}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${s.cls}`}>{s.label}</span>
                  <form action={deleteAnalysis}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      title="Remove"
                      aria-label="Remove this post"
                      className="rounded-md p-1.5 text-faint hover:bg-navy-700 hover:text-red-300"
                    >
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
