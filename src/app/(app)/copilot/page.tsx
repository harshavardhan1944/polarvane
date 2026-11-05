import Link from "next/link";
import { PageHeader } from "@/components/NotBuiltYet";
import { DashboardSwitcher } from "@/components/DashboardSwitcher";
import { listDashboards } from "@/lib/dashboards";
import { computeInsights, loadComments } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { listChats, loadChat, type StoredMessage } from "./actions";
import { TalonChat, type TalonSummary } from "./TalonChat";

export const instant = false;

export default async function CopilotPage(props: PageProps<"/copilot">) {
  const sp = await props.searchParams;
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
  const posts = (data ?? [])
    .filter((a) => !current || a.dashboard_id === current)
    .map((a) => ({
      id: a.id,
      label: `${a.post_type === "reel" ? "Reel" : "Post"} · ${a.shortcode}`,
    }));
  const switcher = <DashboardSwitcher dashboards={dashboards} current={current} basePath="/copilot" />;

  if (posts.length === 0) {
    return (
      <>
        <PageHeader title="Talon Copilot" subtitle="Ask questions about your audience in plain English." />
        {switcher}
        <div className="panel p-6 text-sm text-muted">
          {currentName ? `“${currentName}” has no analyzed posts yet. ` : "Talon needs analyzed comments to answer questions. "}
          <Link href={`/analyze${current ? `?d=${current}` : ""}`} className="text-brand-blue hover:underline">
            Analyze a post first
          </Link>
          .
        </div>
      </>
    );
  }

  let summary: TalonSummary = { total: 0, sentiment: { positive: 0, neutral: 0, negative: 0 }, topics: [] };
  try {
    const { rows } = await loadComments(supabase, undefined, current ? posts.map((p) => p.id) : undefined);
    const ins = computeInsights(rows);
    summary = {
      total: ins.total,
      sentiment: ins.sentiment,
      topics: ins.topics.slice(0, 6).map((t) => ({ topic: t.topic, total: t.total })),
    };
  } catch (e) {
    console.error("[polarvane] copilot summary failed:", e);
  }

  const chats = await listChats(current).catch(() => []);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 1000) : "";
  let post = typeof sp.post === "string" && posts.some((p) => p.id === sp.post) ? sp.post : "";

  // Reopen the most recent conversation, unless a new question was sent from the dashboard.
  let initialChatId: string | null = null;
  let initialMessages: StoredMessage[] = [];
  if (!q && chats[0]) {
    const last = await loadChat(chats[0].id).catch(() => null);
    if (last) {
      initialChatId = chats[0].id;
      initialMessages = last.messages;
      if (last.postId && posts.some((p) => p.id === last.postId)) post = last.postId;
    }
  }

  return (
    <>
      <h1 className="sr-only">Talon copilot</h1>
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
        dashboardName={currentName}
      />
    </>
  );
}
