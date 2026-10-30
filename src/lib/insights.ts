import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Loads a user's analyzed comments and turns them into dashboard numbers.
// Every figure is computed from real rows — nothing is estimated or invented.

export type Sentiment = "positive" | "neutral" | "negative";

export type CommentRow = {
  id: string;
  analysis_id: string;
  text: string;
  author_username: string | null;
  posted_at: string | null;
  like_count: number | null;
  sentiment: Sentiment | null;
  sentiment_confidence: number | null;
  topics: string[];
};

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

export type TopicStat = { topic: string; total: number; positive: number; neutral: number; negative: number };
export type DayStat = { date: string; positive: number; neutral: number; negative: number };

export function computeInsights(rows: CommentRow[]) {
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  const topics = new Map<string, TopicStat>();
  const days = new Map<string, DayStat>();
  let timestamped = 0;

  for (const r of rows) {
    if (!r.sentiment) continue;
    sentiment[r.sentiment]++;
    for (const t of r.topics ?? []) {
      const s = topics.get(t) ?? { topic: t, total: 0, positive: 0, neutral: 0, negative: 0 };
      s.total++;
      s[r.sentiment]++;
      topics.set(t, s);
    }
    if (r.posted_at) {
      timestamped++;
      const date = r.posted_at.slice(0, 10);
      const d = days.get(date) ?? { date, positive: 0, neutral: 0, negative: 0 };
      d[r.sentiment]++;
      days.set(date, d);
    }
  }

  const total = sentiment.positive + sentiment.neutral + sentiment.negative;
  const topicList = [...topics.values()].sort((a, b) => b.total - a.total);
  const dayList = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));

  const byEngagement = (s: Sentiment) =>
    rows
      .filter((r) => r.sentiment === s)
      .sort(
        (a, b) =>
          (b.like_count ?? 0) - (a.like_count ?? 0) ||
          (b.sentiment_confidence ?? 0) - (a.sentiment_confidence ?? 0),
      )
      .slice(0, 4);

  return {
    total,
    sentiment,
    topics: topicList,
    days: dayList,
    timestamped,
    topPositive: byEngagement("positive"),
    topNegative: byEngagement("negative"),
  };
}
