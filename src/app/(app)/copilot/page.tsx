import Link from "next/link";
import { PageHeader } from "@/components/NotBuiltYet";
import { computeInsights, loadComments } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { TalonChat, type TalonSummary } from "./TalonChat";

export const instant = false;

export default async function CopilotPage(props: PageProps<"/copilot">) {
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("analyses")
    .select("id, shortcode, post_type")
    .eq("status", "completed")
    .order("created_at", { ascending: false });
  const posts = (data ?? []).map((a) => ({
    id: a.id as string,
    label: `${a.post_type === "reel" ? "Reel" : "Post"} · ${a.shortcode}`,
  }));

  if (posts.length === 0) {
    return (
      <>
        <PageHeader title="Talon Copilot" subtitle="Ask questions about your audience in plain English." />
        <div className="panel p-6 text-sm text-muted">
          Talon needs analyzed comments to answer questions.{" "}
          <Link href="/analyze" className="text-brand-blue hover:underline">
            Analyze a post first
          </Link>
          .
        </div>
      </>
    );
  }

  let summary: TalonSummary = { total: 0, sentiment: { positive: 0, neutral: 0, negative: 0 }, topics: [] };
  try {
    const { rows } = await loadComments(supabase);
    const ins = computeInsights(rows);
    summary = {
      total: ins.total,
      sentiment: ins.sentiment,
      topics: ins.topics.slice(0, 6).map((t) => ({ topic: t.topic, total: t.total })),
    };
  } catch (e) {
    console.error("[polarvane] copilot summary failed:", e);
  }

  const q = typeof sp.q === "string" ? sp.q.slice(0, 1000) : "";
  const post = typeof sp.post === "string" && posts.some((p) => p.id === sp.post) ? sp.post : "";

  return (
    <>
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-blue">AI copilot</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Talon</h1>
      </div>
      <TalonChat key={`${q}|${post}`} posts={posts} summary={summary} initialQuestion={q} initialPost={post} />
    </>
  );
}
