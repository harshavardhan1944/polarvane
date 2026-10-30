import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  BarChart3,
  Heart,
  Lightbulb,
  MessageSquareText,
  Smile,
  Sparkles,
  Tags,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { PostFilter } from "@/components/PostFilter";
import { SentimentDonut, SentimentRows, TopicBars, TrendColumns } from "@/components/charts";
import type { CommentRow, KeyInsight, computeInsights } from "@/lib/insights-core";

type Insights = ReturnType<typeof computeInsights>;

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

  const tiles = [
    {
      label: "Comments analyzed",
      value: ins.total.toLocaleString(),
      sub: `across ${postCount} ${postCount === 1 ? "post" : "posts"}`,
      icon: MessageSquareText,
      chip: "bg-brand-blue/15 text-brand-blue",
    },
    {
      label: "Net sentiment",
      value: `${net > 0 ? "+" : ""}${net}`,
      sub: "positive % minus negative %",
      icon: Activity,
      chip: "bg-brand-violet/15 text-violet-300",
    },
    {
      label: "Positive comments",
      value: `${pc(ins.sentiment.positive)}%`,
      sub: `${ins.sentiment.positive.toLocaleString()} comments`,
      icon: Smile,
      chip: "bg-positive/15 text-emerald-300",
    },
    {
      label: "Topics found",
      value: ins.topics.length.toLocaleString(),
      sub: ins.topics[0] ? `top: ${ins.topics[0].topic}` : "none yet",
      icon: Tags,
      chip: "bg-amber-400/10 text-amber-300",
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-brand-blue">Audience overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {scope} · real results from {ins.total.toLocaleString()} analyzed comments
          </p>
        </div>
        <PostFilter posts={posts} value={selected} />
      </div>

      {notice && <div className="panel mb-4 p-3 text-xs text-amber-200">{notice}</div>}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map(({ label, value, sub, icon: Icon, chip }) => (
          <div key={label} className="panel relative overflow-hidden p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <span className="text-xs text-muted">{label}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${chip}`}>
                <Icon size={16} />
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 truncate text-xs text-faint">{sub}</p>
          </div>
        ))}
      </div>

      {/* Sentiment + key insights */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2" icon={Smile} title="Sentiment" subtitle="How the audience feels about the content">
          <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
            <SentimentDonut counts={ins.sentiment} />
            <SentimentRows counts={ins.sentiment} />
          </div>
        </Card>

        <Card className="lg:col-span-3" icon={Lightbulb} title="Key insights" subtitle="Plain-English findings calculated from your data">
          {insights.length === 0 ? (
            <p className="text-sm text-muted">Not enough data for insights yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {insights.map((k) => (
                <li key={k.title} className="rounded-xl border border-navy-700 bg-navy-900/50 p-4">
                  <span
                    className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg ${
                      k.tone === "positive"
                        ? "bg-positive/15 text-emerald-300"
                        : k.tone === "negative"
                          ? "bg-negative/15 text-red-300"
                          : k.tone === "neutral"
                            ? "bg-neutral/20 text-slate-300"
                            : "bg-brand-blue/15 text-brand-blue"
                    }`}
                  >
                    {k.tone === "positive" ? (
                      <ThumbsUp size={14} />
                    ) : k.tone === "negative" ? (
                      <ThumbsDown size={14} />
                    ) : (
                      <BarChart3 size={14} />
                    )}
                  </span>
                  <p className="text-sm font-medium text-ink">{k.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{k.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Topics + Ask Talon */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" icon={Tags} title="Topic distribution" subtitle="What comments talk about · colour shows each topic’s sentiment mix">
          <TopicBars topics={ins.topics} max={8} />
        </Card>

        <div className="panel relative overflow-hidden p-5 lg:col-span-2">
          <div className="brand-gradient pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg">
                <Sparkles size={15} className="text-white" />
              </span>
              <h2 className="text-sm font-semibold">Ask Talon</h2>
            </div>
            <p className="mt-2 text-xs text-muted">Get answers and content ideas backed by real comments.</p>
            <form action="/copilot" method="get" className="mt-4">
              <input type="hidden" name="post" value={selected} />
              <div className="flex gap-2 rounded-xl border border-navy-600 bg-navy-900/80 p-1.5 focus-within:border-brand-blue">
                <input
                  name="q"
                  required
                  maxLength={1000}
                  placeholder="Ask about your audience…"
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-faint"
                />
                <button type="submit" className="brand-gradient rounded-lg px-3 py-1.5 text-xs font-medium text-white">
                  Ask
                </button>
              </div>
            </form>
            <div className="mt-4 space-y-1.5">
              {[
                "What do people like most, and what do they dislike?",
                "Give me 5 content ideas based on these comments.",
                "Which topics get the most positive reactions?",
              ].map((q) => (
                <Link
                  key={q}
                  href={`/copilot?q=${encodeURIComponent(q)}${selected ? `&post=${selected}` : ""}`}
                  className="group flex items-center justify-between rounded-lg border border-navy-700 bg-navy-900/40 px-3 py-2 text-xs text-muted transition-colors hover:border-brand-blue/50 hover:text-ink"
                >
                  {q}
                  <ArrowUpRight size={13} className="shrink-0 text-faint group-hover:text-brand-blue" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trend */}
      <Card
        className="mt-4"
        icon={Activity}
        title="Comments over time"
        subtitle={`Daily volume by sentiment · ${ins.timestamped.toLocaleString()} of ${ins.total.toLocaleString()} comments have a date`}
      >
        {ins.days.length >= 2 ? (
          <TrendColumns days={ins.days} />
        ) : (
          <p className="rounded-lg border border-dashed border-navy-600 p-6 text-center text-sm text-muted">
            {ins.days.length === 1
              ? "All dated comments are from a single day, so there’s no trend yet."
              : "These comments don’t include dates, so a trend can’t be shown."}{" "}
            Analyze more posts to see changes over time.
          </p>
        )}
      </Card>

      {/* Top comments */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TopComments title="Most-liked positive comments" rows={ins.topPositive} tone="positive" />
        <TopComments title="Most-liked negative comments" rows={ins.topNegative} tone="negative" />
      </div>
    </>
  );
}

function Card({
  title,
  subtitle,
  icon: Icon,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel p-5 ${className}`}>
      <div className="mb-4 flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-700/70">
          <Icon size={14} className="text-brand-blue" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function TopComments({ title, rows, tone }: { title: string; rows: CommentRow[]; tone: "positive" | "negative" }) {
  return (
    <Card title={title} icon={tone === "positive" ? ThumbsUp : ThumbsDown} subtitle="Ranked by likes">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No {tone} comments found.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-3 rounded-xl border border-navy-700 bg-navy-900/50 p-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase ${
                  tone === "positive" ? "bg-positive/15 text-emerald-300" : "bg-negative/15 text-red-300"
                }`}
              >
                {(r.author_username ?? "?").charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-relaxed text-ink">{r.text}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-faint">
                  {r.author_username && <span>@{r.author_username}</span>}
                  {r.like_count !== null && (
                    <span className="inline-flex items-center gap-1">
                      <Heart size={11} /> {r.like_count.toLocaleString()}
                    </span>
                  )}
                  {r.topics.length > 0 && <span className="capitalize">{r.topics.join(" · ")}</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DashboardEmpty({ failed }: { failed: boolean }) {
  return (
    <div className="panel relative overflow-hidden p-6 sm:p-10">
      <div className="brand-gradient pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-20 blur-3xl" />
      <p className="text-xs font-medium uppercase tracking-wider text-brand-blue">Get started</p>
      <h2 className="mt-2 text-2xl font-semibold">
        {failed ? "Couldn’t load your data" : "Analyze your first Instagram post"}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        {failed
          ? "Please refresh the page. If this keeps happening, check that the database setup script was run."
          : "Paste a public post or Reel link. Polarvane collects the comments, labels each one as positive, neutral or negative, and groups them into topics. Your dashboard fills in once an analysis is completed."}
      </p>
      <Link
        href="/analyze"
        className="brand-gradient mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-violet/20 hover:opacity-95"
      >
        New analysis <ArrowRight size={15} />
      </Link>
    </div>
  );
}
