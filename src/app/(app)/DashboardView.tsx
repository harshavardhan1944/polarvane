import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, Heart, MessageSquareText, Smile, Sparkles, Tags } from "lucide-react";
import { PostFilter } from "@/components/PostFilter";
import { SentimentDonut, SentimentRows, TopicBars, TrendColumns } from "@/components/charts";
import type { CommentRow, KeyInsight, computeInsights } from "@/lib/insights-core";

type Insights = ReturnType<typeof computeInsights>;

function moodOf(net: number) {
  if (net >= 40) return "overwhelmingly warm";
  if (net >= 20) return "mostly warm";
  if (net > -10) return "mixed";
  if (net > -30) return "leaning critical";
  return "largely critical";
}

export function DashboardView({
  posts,
  selected,
  ins,
  insights,
  postCount,
  notice,
}: {
  posts: { id: string; label: string }[];
  selected: string;
  ins: Insights;
  insights: KeyInsight[];
  postCount: number;
  notice?: string | null;
}) {
  const pc = (n: number) => (ins.total ? Math.round((n / ins.total) * 100) : 0);
  const net = pc(ins.sentiment.positive) - pc(ins.sentiment.negative);
  const scope = selected ? posts.find((p) => p.id === selected)?.label ?? "Selected post" : "All analyzed posts";
  const topTopics = ins.topics.slice(0, 2).map((t) => t.topic);

  const metrics = [
    {
      label: "Comments analyzed",
      value: ins.total.toLocaleString(),
      sub: `across ${postCount} ${postCount === 1 ? "post" : "posts"}`,
      icon: MessageSquareText,
      chip: "bg-brand-blue/15 text-[#8fb0ff] ring-brand-blue/30",
      glow: "rgba(91,140,255,0.45)",
    },
    {
      label: "Net sentiment",
      value: `${net > 0 ? "+" : ""}${net}`,
      sub: "positive % minus negative %",
      icon: Activity,
      chip: "bg-brand-violet/15 text-[#c3b0ff] ring-brand-violet/30",
      glow: "rgba(156,124,255,0.45)",
    },
    {
      label: "Positive comments",
      value: `${pc(ins.sentiment.positive)}%`,
      sub: `${ins.sentiment.positive.toLocaleString()} comments`,
      icon: Smile,
      chip: "bg-positive/15 text-emerald-300 ring-positive/30",
      glow: "rgba(31,174,126,0.4)",
    },
    {
      label: "Topics found",
      value: ins.topics.length.toLocaleString(),
      sub: topTopics[0] ? `top: ${topTopics[0]}` : "none yet",
      icon: Tags,
      chip: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
      glow: "rgba(251,191,36,0.3)",
    },
  ];

  return (
    <>
      {/* Readout: the audience in one sentence, built from real numbers */}
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-navy-600 bg-navy-900/60 px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-positive" /> {scope}
          </p>
          <h1 className="font-display mt-4 text-4xl leading-[1.1] sm:text-[44px]">
            Your audience is <span className="brand-text">{moodOf(net)}</span>.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
            <span className="num text-ink">{pc(ins.sentiment.positive)}%</span> of{" "}
            <span className="num text-ink">{ins.total.toLocaleString()}</span> analyzed comments are positive and{" "}
            <span className="num text-ink">{pc(ins.sentiment.negative)}%</span> negative
            {topTopics.length > 0 && (
              <>
                . The conversation centres on <span className="text-ink">{topTopics.join(" and ")}</span>
              </>
            )}
            .
          </p>
        </div>
        <PostFilter posts={posts} value={selected} />
      </header>

      {notice && <div className="panel mb-4 p-3 text-xs text-amber-200">{notice}</div>}

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(({ label, value, sub, icon: Icon, chip, glow }) => (
          <div key={label} className="panel stat-card p-5" style={{ ["--glow" as string]: glow }}>
            <div className="relative flex items-center justify-between">
              <p className="text-sm text-muted">{label}</p>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${chip}`}>
                <Icon size={17} />
              </span>
            </div>
            <p className="font-display num relative mt-4 text-4xl leading-none">{value}</p>
            <p className="relative mt-2 truncate text-xs text-faint">{sub}</p>
          </div>
        ))}
      </section>

      {/* Sentiment + findings */}
      <section className="panel mt-4 grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="p-6">
          <h2 className="text-[15px] font-semibold">Sentiment</h2>
          <p className="text-xs text-muted">Share of comments by AI label</p>
          <div className="mt-6 flex flex-col items-center gap-8 sm:flex-row lg:flex-col xl:flex-row">
            <SentimentDonut counts={ins.sentiment} size={176} />
            <SentimentRows counts={ins.sentiment} />
          </div>
        </div>
        <div className="border-t hairline p-6 lg:border-l lg:border-t-0">
          <h2 className="text-[15px] font-semibold">What stands out</h2>
          <p className="text-xs text-muted">Findings calculated directly from your numbers</p>
          {insights.length === 0 ? (
            <p className="mt-6 text-sm text-muted">Not enough data for findings yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-navy-700">
              {insights.map((k) => (
                <li key={k.title} className="flex gap-4 py-4 first:pt-2 last:pb-0">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      k.tone === "positive"
                        ? "bg-positive"
                        : k.tone === "negative"
                          ? "bg-negative"
                          : k.tone === "neutral"
                            ? "bg-neutral"
                            : "bg-brand-blue"
                    }`}
                  />
                  <div>
                    <p className="text-[15px] text-ink">{k.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted">{k.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Topics + Ask Talon */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="panel p-6">
          <h2 className="text-[15px] font-semibold">Topics</h2>
          <p className="mb-5 text-xs text-muted">Ranked by how many comments mention them, coloured by sentiment</p>
          <TopicBars topics={ins.topics} max={8} />
        </section>

        <section className="relative rounded-2xl p-px">
          <div className="brand-gradient absolute inset-0 rounded-2xl opacity-60" aria-hidden />
          <div className="relative h-full rounded-[15px] bg-navy-900 p-6">
            <div className="flex items-center gap-2.5">
              <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg">
                <Sparkles size={15} className="text-white" />
              </span>
              <h2 className="text-lg font-semibold">Ask Talon</h2>
            </div>
            <p className="mt-3 text-sm text-muted">Answers and content ideas, backed by quotes from your comments.</p>
            <form action="/copilot" method="get" className="mt-5">
              <input type="hidden" name="post" value={selected} />
              <label htmlFor="ask-talon" className="sr-only">
                Question for Talon
              </label>
              <div className="flex gap-2 rounded-xl border border-navy-600 bg-navy-950 p-1.5 focus-within:border-brand-blue">
                <input
                  id="ask-talon"
                  name="q"
                  required
                  maxLength={1000}
                  placeholder="What should my next post be about?"
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-faint"
                />
                <button type="submit" className="brand-gradient rounded-lg px-3.5 py-1.5 text-sm font-medium text-white">
                  Ask
                </button>
              </div>
            </form>
            <div className="mt-5 divide-y divide-navy-700 border-t hairline">
              {[
                "What do people like most, and what do they dislike?",
                "Give me 5 content ideas based on these comments.",
                "Which topics get the most positive reactions?",
              ].map((q) => (
                <Link
                  key={q}
                  href={`/copilot?q=${encodeURIComponent(q)}${selected ? `&post=${selected}` : ""}`}
                  className="group flex items-center justify-between gap-3 py-3 text-sm text-muted transition-colors hover:text-ink"
                >
                  {q}
                  <ArrowUpRight size={15} className="shrink-0 text-faint transition-colors group-hover:text-brand-blue" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Trend */}
      <section className="panel mt-4 p-6">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold">Comments over time</h2>
            <p className="text-xs text-muted">Daily volume, split by sentiment</p>
          </div>
          <p className="num text-xs text-faint">
            {ins.timestamped.toLocaleString()} of {ins.total.toLocaleString()} comments dated
          </p>
        </div>
        {ins.days.length >= 2 ? (
          <TrendColumns days={ins.days} />
        ) : (
          <p className="rounded-xl border border-dashed border-navy-600 p-8 text-center text-sm text-muted">
            {ins.days.length === 1
              ? "All dated comments are from a single day, so there’s no trend yet."
              : "These comments don’t include dates, so a trend can’t be shown."}{" "}
            Analyze more posts to see change over time.
          </p>
        )}
      </section>

      {/* Voices */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Voices title="Most-liked praise" rows={ins.topPositive} tone="positive" />
        <Voices title="Most-liked criticism" rows={ins.topNegative} tone="negative" />
      </div>
    </>
  );
}

function Voices({ title, rows, tone }: { title: string; rows: CommentRow[]; tone: "positive" | "negative" }) {
  return (
    <section className="panel p-6">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <span className={`h-2 w-2 rounded-full ${tone === "positive" ? "bg-positive" : "bg-negative"}`} />
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No {tone === "positive" ? "positive" : "negative"} comments found.</p>
      ) : (
        <ul className="mt-2 divide-y divide-navy-700">
          {rows.map((r) => (
            <li key={r.id} className="py-4 last:pb-0">
              <blockquote className="text-[15px] leading-relaxed text-ink">“{r.text}”</blockquote>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
                {r.author_username && <span>@{r.author_username}</span>}
                {r.like_count !== null && (
                  <span className="num inline-flex items-center gap-1">
                    <Heart size={11} /> {r.like_count.toLocaleString()}
                  </span>
                )}
                {r.topics.length > 0 && <span className="capitalize">{r.topics.join(", ")}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DashboardEmpty({ failed }: { failed: boolean }) {
  return (
    <div className="py-10">
      <h1 className="font-display max-w-2xl text-5xl leading-[1.05]">
        {failed ? "We couldn’t load your data." : "Find out what your audience really thinks."}
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
        {failed
          ? "Refresh the page. If this keeps happening, check that the database setup script was run in Supabase."
          : "Paste a public Instagram post or Reel link. Polarvane collects the comments, labels each one as positive, neutral or negative, and groups them into topics. This page fills in once your first analysis finishes."}
      </p>
      <Link
        href="/analyze"
        className="brand-gradient mt-7 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-brand-violet/20 hover:opacity-95"
      >
        Analyze a post <ArrowRight size={15} />
      </Link>
    </div>
  );
}
