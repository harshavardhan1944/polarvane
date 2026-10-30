"use server";

import { refresh } from "next/cache";
import { parseInstagramUrl } from "@/lib/instagram";
import { ApifyError, getDatasetItems, getRun, mapApifyItems, startCommentRun } from "@/lib/apify";
import { AiError, classifyComments } from "@/lib/ai";
import { COMMENT_LIMITS } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export type CreateAnalysisState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "duplicate"; message: string }
  | { status: "created"; message: string };

function dbErrorMessage(code: string | undefined, message: string) {
  if (code === "42P01" || /relation .* does not exist|could not find the table/i.test(message))
    return "The database isn’t set up yet. Please run the setup script in Supabase (Step 2 instructions).";
  if (code === "42501") return "Permission denied. Please sign out and sign in again.";
  return "Couldn’t save this analysis. Please try again in a moment.";
}

export async function createAnalysis(
  _prev: CreateAnalysisState,
  formData: FormData,
): Promise<CreateAnalysisState> {
  const parsed = parseInstagramUrl(String(formData.get("url") ?? ""));
  if (!parsed.ok) return { status: "error", message: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Your session has expired. Please sign in again." };

  // Duplicate check: has this user already added this post?
  const { data: existing, error: lookupError } = await supabase
    .from("analyses")
    .select("id, created_at")
    .eq("shortcode", parsed.shortcode)
    .maybeSingle();
  if (lookupError) {
    console.error("[polarvane] analyses lookup failed:", lookupError);
    return { status: "error", message: dbErrorMessage(lookupError.code, lookupError.message) };
  }
  if (existing) {
    return {
      status: "duplicate",
      message: "You’ve already added this post. It’s in your list below.",
    };
  }

  const { error: insertError } = await supabase.from("analyses").insert({
    user_id: user.id,
    post_url: parsed.canonicalUrl,
    shortcode: parsed.shortcode,
    post_type: parsed.postType,
    status: "queued",
  });
  if (insertError) {
    if (insertError.code === "23505")
      return { status: "duplicate", message: "You’ve already added this post. It’s in your list below." };
    console.error("[polarvane] analyses insert failed:", insertError);
    return { status: "error", message: dbErrorMessage(insertError.code, insertError.message) };
  }

  refresh();
  return {
    status: "created",
    message: `${parsed.postType === "reel" ? "Reel" : "Post"} saved. Choose how many comments to collect below.`,
  };
}

export async function deleteAnalysis(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // Row Level Security guarantees users can only delete their own rows.
  const { error } = await supabase.from("analyses").delete().eq("id", id);
  if (error) console.error("[polarvane] analyses delete failed:", error);
  refresh();
}

// ---------------- Step 3: comment collection through Apify ----------------

const ALLOWED_LIMITS: readonly number[] = COMMENT_LIMITS;
const MAX_ACTIVE_JOBS = 3;

export type CollectionResult =
  | { ok: true; status: string; message?: string }
  | { ok: false; message: string };

export async function startCollection(id: string, limit: number): Promise<CollectionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Invalid request." };
  if (!ALLOWED_LIMITS.includes(limit)) return { ok: false, message: "Please choose a comment limit." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again." };

  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, post_url, status")
    .eq("id", id)
    .maybeSingle();
  if (!analysis) return { ok: false, message: "Post not found." };
  if (!["queued", "failed"].includes(analysis.status))
    return { ok: false, message: "This post is already being processed." };

  // Protect against accidental runaway costs: limit parallel jobs per user.
  const { count } = await supabase
    .from("analyses")
    .select("id", { count: "exact", head: true })
    .eq("status", "collecting");
  if ((count ?? 0) >= MAX_ACTIVE_JOBS)
    return { ok: false, message: `You can run up to ${MAX_ACTIVE_JOBS} collections at once. Please wait for one to finish.` };

  // Claim the job first so a double-click can't start two paid runs.
  const { data: claimed } = await supabase
    .from("analyses")
    .update({ status: "collecting", comment_limit: limit, error_message: null, apify_run_id: null })
    .eq("id", id)
    .in("status", ["queued", "failed"])
    .select("id");
  if (!claimed || claimed.length === 0) return { ok: false, message: "This post is already being processed." };

  try {
    const { runId } = await startCommentRun(analysis.post_url, limit);
    await supabase.from("analyses").update({ apify_run_id: runId }).eq("id", id);
    refresh();
    return { ok: true, status: "collecting" };
  } catch (err) {
    const message = err instanceof ApifyError ? err.message : "Couldn’t start collection. Please try again.";
    console.error("[polarvane] start collection failed:", err);
    await supabase.from("analyses").update({ status: "failed", error_message: message }).eq("id", id);
    refresh();
    return { ok: false, message };
  }
}

export async function checkCollection(id: string): Promise<CollectionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Invalid request." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again." };

  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, status, apify_run_id, comment_limit, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!analysis) return { ok: false, message: "Post not found." };
  if (analysis.status !== "collecting") return { ok: true, status: analysis.status };

  const fail = async (message: string) => {
    await supabase.from("analyses").update({ status: "failed", error_message: message }).eq("id", id);
    refresh();
    return { ok: true as const, status: "failed", message };
  };

  if (!analysis.apify_run_id) {
    // Run was never registered (e.g. the server stopped mid-start). Give it 2 minutes.
    const age = Date.now() - new Date(analysis.updated_at).getTime();
    return age > 120_000 ? fail("Collection didn’t start properly. Please try again.") : { ok: true, status: "collecting" };
  }

  try {
    const run = await getRun(analysis.apify_run_id);
    if (run.status === "READY" || run.status === "RUNNING") return { ok: true, status: "collecting" };
    if (run.status !== "SUCCEEDED") {
      const why = run.status === "TIMED-OUT" || run.status === "TIMING-OUT" ? "timed out" : run.status.toLowerCase();
      return fail(`Apify collection ${why}.${run.statusMessage ? ` ${run.statusMessage}` : ""}`);
    }

    const items = await getDatasetItems(run.datasetId, analysis.comment_limit);
    const { comments, errors } = mapApifyItems(items);

    if (comments.length === 0) {
      return fail(
        errors[0]
          ? `No comments collected: ${errors[0]}`
          : "No comments were found. The post may be private, have comments turned off, or have no comments yet.",
      );
    }

    // Save in batches. Duplicates (same comment twice) are ignored safely.
    for (let i = 0; i < comments.length; i += 500) {
      const batch = comments.slice(i, i + 500).map((c) => ({ ...c, analysis_id: id, user_id: user.id }));
      const { error } = await supabase
        .from("comments")
        .upsert(batch, { onConflict: "analysis_id,external_id", ignoreDuplicates: true });
      if (error) {
        console.error("[polarvane] saving comments failed:", error);
        return fail("Comments were collected but couldn’t be saved. Please try again.");
      }
    }

    const { count } = await supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("analysis_id", id);

    await supabase
      .from("analyses")
      .update({ status: "analyzing", comments_collected: count ?? comments.length, error_message: null })
      .eq("id", id);
    refresh();
    return { ok: true, status: "analyzing" };
  } catch (err) {
    if (err instanceof ApifyError && (err.kind === "rate_limit" || err.kind === "other")) {
      // Temporary problem: keep waiting, the next check will retry.
      return { ok: true, status: "collecting", message: err.message };
    }
    console.error("[polarvane] check collection failed:", err);
    return fail(err instanceof ApifyError ? err.message : "Something went wrong while collecting comments.");
  }
}

// ---------------- Step 4: AI sentiment + topic analysis ----------------

const AI_BATCH_SIZE = 40;

export type AnalyzeResult =
  | { ok: true; status: string; analyzed: number; total: number; retryLater?: string }
  | { ok: false; message: string };

export async function analyzeNextBatch(id: string): Promise<AnalyzeResult> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Invalid request." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again." };

  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, status, comments_collected")
    .eq("id", id)
    .maybeSingle();
  if (!analysis) return { ok: false, message: "Post not found." };

  const progress = async () => {
    const { count: analyzed } = await supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("analysis_id", id)
      .not("sentiment", "is", null);
    const { count: total } = await supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("analysis_id", id);
    return { analyzed: analyzed ?? 0, total: total ?? 0 };
  };

  if (analysis.status !== "analyzing") {
    const p = await progress();
    return { ok: true, status: analysis.status, ...p };
  }

  const { data: batch, error } = await supabase
    .from("comments")
    .select("id, text")
    .eq("analysis_id", id)
    .is("sentiment", null)
    .is("analysis_error", null)
    .limit(AI_BATCH_SIZE);
  if (error) {
    console.error("[polarvane] loading comments failed:", error);
    return { ok: false, message: "Couldn’t load comments for analysis. Please refresh." };
  }

  if (batch && batch.length > 0) {
    let results;
    try {
      results = await classifyComments(batch);
    } catch (err) {
      if (err instanceof AiError && (err.kind === "busy" || err.kind === "bad_output")) {
        const p = await progress();
        return { ok: true, status: "analyzing", ...p, retryLater: err.message };
      }
      console.error("[polarvane] AI analysis failed:", err);
      return { ok: false, message: err instanceof AiError ? err.message : "AI analysis failed. Please try again." };
    }

    const returned = new Set(results.map((r) => r.id));
    await Promise.all([
      ...results.map((r) =>
        supabase
          .from("comments")
          .update({ sentiment: r.sentiment, sentiment_confidence: r.confidence, topics: r.topics })
          .eq("id", r.id),
      ),
      // Never guess: comments the AI skipped are marked, not given a made-up label.
      ...batch
        .filter((c) => !returned.has(c.id))
        .map((c) =>
          supabase.from("comments").update({ analysis_error: "AI did not return a result" }).eq("id", c.id),
        ),
    ]);
  }

  const p = await progress();
  const { count: remaining } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("analysis_id", id)
    .is("sentiment", null)
    .is("analysis_error", null);

  const done = (remaining ?? 0) === 0;
  await supabase
    .from("analyses")
    .update({ comments_analyzed: p.analyzed, ...(done ? { status: "completed" } : {}) })
    .eq("id", id);
  if (done) refresh();
  return { ok: true, status: done ? "completed" : "analyzing", ...p };
}
