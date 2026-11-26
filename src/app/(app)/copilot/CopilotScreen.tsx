import Link from "next/link";
import { PageHeader } from "@/components/NotBuiltYet";
import { DashboardSwitcher } from "@/components/DashboardSwitcher";
import { listDashboards, loadPostTitles, postLabel } from "@/lib/dashboards";
import { computeInsights, loadComments } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { listChats, loadChat, type StoredMessage } from "./actions";
import { AgentRunner } from "../agent/AgentRunner";
import { listRuns } from "../agent/actions";
import { TalonChat, type TalonSummary } from "./TalonChat";

// Shared by Talon (all sources) and the Reddit section (Reddit threads only).
export async function CopilotScreen({
  sp,
  source = "",
  basePath = "/copilot",
  addHref,
}: {
  sp: Record<string, string | string[] | undefined>;
  source?: "" | "reddit";
  basePath?: string;
  addHref?: string;
}) {
  const supabase = await createClient();
  const dashboards = await listDashboards(supabase);
  const current = typeof sp.d === "string" && dashboards?.some((d) => d.id === sp.d) ? sp.d : "";
  const currentName = dashboards?.find((d) => d.id === current)?.name ?? "";

  type A = { id: string; shortcode: string; post_type: string; dashboard_id?: string | null };
  type R = { data: A[] | null; error: { message: string } | null };
  const pq = (cols: string) =>
    supabase.from("analyses").select(cols).eq("status", "completed").order("created_at", { ascending: false });
  const first = (await pq("id, shortcode, post_type, dashboard_id")) as unknown as R;
  const data = first.error ? ((await pq("id, shortcode, post_type")) as unknown as R).data : first.data;
  const titles = await loadPostTitles(supabase);
  const posts = (data ?? [])
    .filter((a) => !current || a.dashboard_id === current)
    .filter((a) => source !== "reddit" || a.post_type === "reddit")
    .map((a) => ({ id: a.id, label: postLabel(a, titles) }));
  const switcher = <DashboardSwitcher dashboards={dashboards} current={current} basePath={basePath} />;

  // "Ask Polarvane" has two modes: quick answers (Talon) and a full plan (the agent). Reddit pages use quick answers only.
  const plan = !source && sp.mode === "plan";
  const modeTabs = !source && (
    <div className="mb-4 inline-flex rounded-xl border border-navy-700 bg-navy-900/60 p-1 text-sm" role="tablist">
      <Link
        href={`${basePath}${current ? `?d=${current}` : ""}`}
        role="tab"
        aria-selected={!plan}
        className={`rounded-lg px-4 py-2 ${!plan ? "bg-navy-700 text-ink shadow" : "text-muted hover:text-ink"}`}
      >
        Quick answer
      </Link>
      <Link
        href={`${basePath}?mode=plan`}
        role="tab"
        aria-selected={plan}
        className={`rounded-lg px-4 py-2 ${plan ? "bg-navy-700 text-ink shadow" : "text-muted hover:text-ink"}`}
      >
        Full plan (agent)
      </Link>
    </div>
  );
  if (plan) {
    return (
      <>
        <PageHeader
          title="Ask Polarvane"
          subtitle="Full plan: give a goal, and the agent runs Polarvane's tools on your comments step by step and writes one plan. It only reads and suggests; it never posts."
        />
        {modeTabs}
        <AgentRunner dashboards={dashboards ?? []} initialRuns={await listRuns().catch(() => [])} />
      </>
    );
  }

  if (posts.length === 0) {
    return (
      <>
        <PageHeader
          title={source === "reddit" ? "Ask Talon about Reddit" : "Ask Polarvane"}
          subtitle={
            source === "reddit"
              ? "Talon answers only from your Reddit threads' comments."
              : "Ask questions about your audience in plain English."
          }
        />
        {modeTabs}
        {switcher}
        <div className="panel p-6 text-sm text-muted">
          {source === "reddit"
            ? `No analyzed Reddit threads${currentName ? ` in “${currentName}”` : ""} yet. `
            : currentName
              ? `“${currentName}” has no analyzed posts yet. `
              : "Talon needs analyzed comments to answer questions. "}
          <Link href={addHref ?? `/analyze${current ? `?d=${current}` : ""}`} className="text-brand-blue hover:underline">
            {source === "reddit" ? "Add Reddit threads first" : "Analyze a post first"}
          </Link>
          .
        </div>
      </>
    );
  }

  let summary: TalonSummary = { total: 0, sentiment: { positive: 0, neutral: 0, negative: 0 }, topics: [] };
  try {
    const { rows } = await loadComments(supabase, undefined, current || source ? posts.map((p) => p.id) : undefined);
    const ins = computeInsights(rows);
    summary = {
      total: ins.total,
      sentiment: ins.sentiment,
      topics: ins.topics.slice(0, 6).map((t) => ({ topic: t.topic, total: t.total })),
    };
  } catch (e) {
    console.error("[polarvane] copilot summary failed:", e);
  }

  const chats = await listChats(current, source).catch(() => []);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 1000) : "";
  let post = typeof sp.post === "string" && posts.some((p) => p.id === sp.post) ? sp.post : "";

  // Reopen the most recent conversation, unless a new question was sent from the dashboard.
  let initialChatId: string | null = null;
  let initialMessages: StoredMessage[] = [];
  // On Reddit pages, reopen only when chats are kept per source (so it's a Reddit chat).
  if (!q && chats[0] && (!source || chats[0].sourced)) {
    const last = await loadChat(chats[0].id).catch(() => null);
    if (last) {
      initialChatId = chats[0].id;
      initialMessages = last.messages;
      if (last.postId && posts.some((p) => p.id === last.postId)) post = last.postId;
    }
  }

  return (
    <>
      <h1 className="sr-only">{source === "reddit" ? "Ask Talon about Reddit" : "Ask Polarvane"}</h1>
      {modeTabs}
      {source === "reddit" && (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs text-orange-200">
          Reddit only: Talon answers from {posts.length} Reddit thread{posts.length === 1 ? "" : "s"}
        </p>
      )}
      {switcher}
      <TalonChat
        key={`${current}|${q}|${post}|${initialChatId ?? ""}`}
        posts={posts}
        summary={summary}
        initialQuestion={q}
        initialPost={post}
        initialChats={chats}
        initialChatId={initialChatId}
        initialMessages={initialMessages}
        dashboardId={current}
        dashboardName={source === "reddit" ? (currentName ? `Reddit · ${currentName}` : "Reddit") : currentName}
        source={source}
      />
    </>
  );
}
