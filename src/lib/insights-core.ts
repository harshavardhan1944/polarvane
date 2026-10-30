// Pure calculations (safe to use anywhere). Every figure comes from real rows.
import type { CommentRow, Sentiment } from "./insights-types";
export type { CommentRow, Sentiment } from "./insights-types";

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

export type KeyInsight = { tone: "positive" | "negative" | "neutral" | "info"; title: string; detail: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pc = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

// Plain-English findings derived only from the computed numbers above.
export function keyInsights(ins: ReturnType<typeof computeInsights>): KeyInsight[] {
  const out: KeyInsight[] = [];
  if (!ins.total) return out;
  const { positive, negative } = ins.sentiment;
  const net = pc(positive, ins.total) - pc(negative, ins.total);
  out.push({
    tone: net >= 20 ? "positive" : net <= -10 ? "negative" : "neutral",
    title: net >= 20 ? "Audience mood is warm" : net <= -10 ? "Audience mood is critical" : "Audience mood is mixed",
    detail: `${pc(positive, ins.total)}% of comments are positive and ${pc(negative, ins.total)}% negative (net sentiment ${net > 0 ? "+" : ""}${net}).`,
  });

  const top = ins.topics[0];
  if (top)
    out.push({
      tone: "info",
      title: `${cap(top.topic)} leads the conversation`,
      detail: `${top.total} comments mention it, ${pc(top.positive, top.total)}% of them positive.`,
    });

  const eligible = ins.topics.filter((t) => t.total >= 3);
  const loved = [...eligible].sort((a, b) => b.positive / b.total - a.positive / a.total)[0];
  if (loved && loved.positive > 0 && loved.topic !== top?.topic)
    out.push({
      tone: "positive",
      title: `${cap(loved.topic)} gets the warmest reactions`,
      detail: `${pc(loved.positive, loved.total)}% positive across ${loved.total} comments.`,
    });

  const criticised = [...eligible].filter((t) => t.negative > 0).sort((a, b) => b.negative / b.total - a.negative / a.total)[0];
  if (criticised)
    out.push({
      tone: "negative",
      title: `Most criticism: ${criticised.topic}`,
      detail: `${pc(criticised.negative, criticised.total)}% of ${criticised.total} comments on this topic are negative.`,
    });

  if (ins.days.length >= 4) {
    const mid = Math.floor(ins.days.length / 2);
    const sum = (ds: DayStat[]) =>
      ds.reduce((a, d) => ({ p: a.p + d.positive, t: a.t + d.positive + d.neutral + d.negative }), { p: 0, t: 0 });
    const a = sum(ins.days.slice(0, mid));
    const b = sum(ins.days.slice(mid));
    if (a.t >= 10 && b.t >= 10) {
      const from = pc(a.p, a.t);
      const to = pc(b.p, b.t);
      if (Math.abs(to - from) >= 5)
        out.push({
          tone: to > from ? "positive" : "negative",
          title: `Positive share ${to > from ? "rose" : "fell"} over time`,
          detail: `From ${from}% in the earlier half of the period to ${to}% in the later half.`,
        });
    }
  }

  const q = ins.topics.find((t) => t.topic === "questions");
  if (q && q.total >= 2)
    out.push({
      tone: "info",
      title: `${q.total} comments ask questions`,
      detail: "Questions are a direct source of content ideas. Ask Talon to group them.",
    });

  return out.slice(0, 4);
}
