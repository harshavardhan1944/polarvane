import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Loads a user's analyzed comments and turns them into dashboard numbers.
// Every figure is computed from real rows — nothing is estimated or invented.

import type { CommentRow } from "./insights-types";
export * from "./insights-core";

const PAGE = 1000;
const MAX_ROWS = 20000;

export async function loadComments(supabase: SupabaseClient, analysisId?: string) {
  const rows: CommentRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    let q = supabase
      .from("comments")
      .select("id, analysis_id, text, author_username, posted_at, like_count, sentiment, sentiment_confidence, topics")
      .not("sentiment", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (analysisId) q = q.eq("analysis_id", analysisId);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...((data ?? []) as CommentRow[]));
    if (!data || data.length < PAGE) break;
  }
  return { rows, truncated: rows.length >= MAX_ROWS };
}

