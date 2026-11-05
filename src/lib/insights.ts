import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Loads a user's analyzed comments and turns them into dashboard numbers.
// Every figure is computed from real rows — nothing is estimated or invented.

import type { CommentRow } from "./insights-types";
import { maskMentions } from "./privacy";
export * from "./insights-core";

const PAGE = 1000;
const MAX_ROWS = 20000;

const COLS = "id, analysis_id, text, author_username, posted_at, like_count, sentiment, sentiment_confidence, topics";

// analysisId: one post. analysisIds: a group of posts (e.g. all creator collaborations).
export async function loadComments(supabase: SupabaseClient, analysisId?: string, analysisIds?: string[]) {
  const rows: CommentRow[] = [];
  if (analysisIds && analysisIds.length === 0) return { rows, truncated: false };
  let withFocus = true;
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const build = (cols: string) => {
      let q = supabase
        .from("comments")
        .select(cols)
        .not("sentiment", "is", null)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (analysisId) q = q.eq("analysis_id", analysisId);
      else if (analysisIds) q = q.in("analysis_id", analysisIds);
      return q;
    };
    let { data, error } = await build(withFocus ? `${COLS}, focus` : COLS);
    if (error && withFocus && /focus|column|schema cache/i.test(error.message)) {
      withFocus = false; // the "focus" column isn't added yet
      ({ data, error } = await build(COLS));
    }
    if (error) throw error;
    const page = (data ?? []) as unknown as CommentRow[];
    // Privacy: usernames are never passed on, and @mentions are hidden.
    rows.push(...page.map((r) => ({ ...r, author_username: null, text: maskMentions(r.text) })));
    if (page.length < PAGE) break;
  }
  return { rows, truncated: rows.length >= MAX_ROWS };
}

