import Link from "next/link";
import { ArrowRight, Heart, MessageSquareText, Smile, Frown, Tags, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/NotBuiltYet";
import { PostFilter } from "@/components/PostFilter";
import { SentimentBar, SentimentLegend, TopicBars, TrendColumns } from "@/components/charts";
import { computeInsights, loadComments, type CommentRow } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function DashboardPage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const supabase = await createClient();

  const { data: analyses, error } = await supabase
    .from("analyses")
    .select("id, shortcode, post_type, status, comments_analyzed, created_at")
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const posts = (analyses ?? []).map((a) => ({
    id: a.id as string,
    label: `${a.post_type === "reel" ? "Reel" : "Post"} · ${a.shortcode}`,
  }));
  const selected = typeof sp.post === "string" && posts.some((p) => p.id === sp.post) ? sp.post : "";

  if (error || posts.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Audience sentiment and topics across the Instagram posts you analyze." />
        <EmptyState failed={Boolean(error)} />
      </>
    );
  }

  let rows: CommentRow[] = [];
  let truncated = false;
  let loadFailed = false;
  try {
    ({ rows, truncated } = await loadComments(supabase, selected || undefined));
  } catch (e) {
    console.error("[polarvane] dashboard load failed:", e);
    loadFailed = true;
  }
  const ins = computeInsights(rows);
  const positivePct = ins.total ? Math.round((ins.sentiment.positive / ins.total) * 100) : 0;
  const negativePct = ins.total ? Math.round((ins.sentiment.negative / ins.total) * 100) : 0;
  const postCount = selected ? 1 : posts.length;

  const tiles = [
    { label: "Comments analyzed", value: ins.total.toLocaleString(), icon: MessageSquareText },
    { label: "Positive", value: `${positivePct}%`, sub: `${ins.sentiment.positive} comments`, icon: Smile },
    { label: "Negative", value: `${negativePct}%`, sub: `${ins.sentiment.negative} comments`, icon: Frown },
    { label: "Topics found", value: ins.topics.length.toLocaleString(), icon: Tags },
    { label: selected ? "Post" : "Posts analyzed", value: postCount.toLocaleString(), icon: TrendingUp },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Real results from {ins.total.toLocaleString()} analyzed Instagram comments.
          </p>
        </div>
        <PostFilter posts={posts} value={selected} />
      </div>

      {loadFailed && (
        <div className="panel mb-4 p-4 text-sm text-red-200">Couldn’t load comments right now. Please refresh.</div>
      )}
      {truncated && (
        <div className="panel mb-4 p-4 text-xs text-amber-200">
          Showing the first 20,000 comments. Pick a single post above for its full results.
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="panel p-4">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs">{label}</span>
              <Icon size={15} className="text-faint" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Sentiment */}
      <section className="panel mt-4 p-5">
        <h2 className="text-sm font-semibold">Sentiment breakdown</h2>
        <p className="mb-4 text-xs text-muted">How the audience feels, based on each comment’s AI label.</p>
        <SentimentBar counts={ins.sentiment} height={14} />
        <div className="mt-3">
          <SentimentLegend counts={ins.sentiment} />
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Topics */}
        <section className="panel p-5">
          <h2 className="text-sm font-semibold">Topic distribution</h2>
          <p className="mb-4 text-xs text-muted">
            What comments talk about. Bar colour shows the sentiment mix inside each topic.
          </p>
          <TopicBars topics={ins.topics} />
        </section>

        {/* Trend */}
        <section className="panel p-5">
          <h2 className="text-sm font-semibold">Comments over time</h2>
          <p className="mb-4 text-xs text-muted">
            Daily comment volume by sentiment ({ins.timestamped.toLocaleString()} of {ins.total.toLocaleString()} comments
            have a date).
          </p>
          {ins.days.length >= 2 ? (
            <TrendColumns days={ins.days} />
          ) : (
            <p className="rounded-lg border border-navy-700 bg-navy-900/60 p-4 text-sm text-muted">
              {ins.days.length === 1
                ? "All dated comments are from a single day, so there’s no trend to show yet."
                : "These comments don’t include dates, so a trend can’t be shown."}{" "}
              Analyze more posts to see changes over time.
            </p>
          )}
        </section>
      </div>

      {/* Top comments */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TopComments title="Most-liked positive comments" rows={ins.topPositive} tone="positive" />
        <TopComments title="Most-liked negative comments" rows={ins.topNegative} tone="negative" />
      </div>
    </>
  );
}

function TopComments({ title, rows, tone }: { title: string; rows: CommentRow[]; tone: "positive" | "negative" }) {
  return (
    <section className="panel p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className={`h-2.5 w-2.5 rounded-full ${tone === "positive" ? "bg-positive" : "bg-negative"}`} />
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No {tone} comments found.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-navy-700 bg-navy-900/50 p-3">
              <p className="text-sm leading-relaxed text-ink">“{r.text}”</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-faint">
                {r.author_username && <span>@{r.author_username}</span>}
                {r.like_count !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Heart size={11} /> {r.like_count.toLocaleString()}
                  </span>
                )}
                {r.topics.length > 0 && <span className="capitalize">{r.topics.join(" · ")}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyState({ failed }: { failed: boolean }) {
  return (
    <div className="panel relative overflow-hidden p-6 sm:p-8">
      <div className="brand-gradient pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl" />
      <p className="text-xs font-medium uppercase tracking-wider text-brand-blue">Get started</p>
      <h2 className="mt-2 text-xl font-semibold">
        {failed ? "Couldn’t load your data" : "Analyze your first Instagram post"}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        {failed
          ? "Please refresh the page. If this keeps happening, check that the database setup script was run."
          : "Paste a public post or Reel link. Polarvane collects the comments, labels each one as positive, neutral or negative, and groups them into topics. Charts appear here once an analysis is completed."}
      </p>
      <Link
        href="/analyze"
        className="brand-gradient mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-violet/20 hover:opacity-95"
      >
        New analysis <ArrowRight size={15} />
      </Link>
    </div>
  );
}
