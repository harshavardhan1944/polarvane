"use server";

import { AiError } from "@/lib/ai";
import { ApifyError, getDatasetItems, getRun, mapApifyItems, startCommentRun, startRedditRunMany, startRedditSearch } from "@/lib/apify";
import { parseInstagramUrl } from "@/lib/instagram";
import {
  chooseThreads,
  planResearch,
  writeLaunchReport,
  type AiCheck,
  type LaunchComment,
  type LaunchInput,
  type LaunchReport,
  type LaunchResearchPlan,
  type ThreadHit,
} from "@/lib/launch";
import { maskMentions } from "@/lib/privacy";
import { mapApifyRedditItems, mapRedditSearchItems, parseRedditUrl } from "@/lib/reddit";
import { createClient } from "@/lib/supabase/server";
import { makeTicket, readTicket } from "@/lib/tickets";
import { askAssistant, judgeAnswer } from "@/lib/visibility";

type Fail = { ok: false; message: string };
const PER_THREAD = 150;
const PER_POST = 150;

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function fail(e: unknown, what: string): Fail {
  if (e instanceof AiError || e instanceof ApifyError) return { ok: false, message: e.message };
  console.error(`[polarvane] launch ${what} failed:`, e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

const s = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

function cleanInput(i: LaunchInput): LaunchInput | null {
  const out = {
    product: s(i?.product, 120),
    brand: s(i?.brand, 80),
    market: s(i?.market, 60) || "India",
    competitors: s(i?.competitors, 200),
    notes: s(i?.notes, 500),
  };
  return out.product.length >= 3 ? out : null;
}

// 1. Plan the research.
export async function launchPlan(input: LaunchInput): Promise<{ ok: true; plan: LaunchResearchPlan } | Fail> {
  const { user } = await signedIn();
  if (!user) return { ok: false, message: "Please sign in again." };
  const i = cleanInput(input);
  if (!i) return { ok: false, message: "Describe the product in a few words." };
  try {
    return { ok: true, plan: await planResearch(i) };
  } catch (e) {
    return fail(e, "plan");
  }
}

// 2. Search Reddit (cheap: thread titles only).
export async function launchSearch(query: string): Promise<{ ok: true; ticket: string } | Fail> {
  const { user } = await signedIn();
  if (!user) return { ok: false, message: "Please sign in again." };
  const q = s(query, 80);
  if (q.length < 2) return { ok: false, message: "Empty search." };
  try {
    const { runId } = await startRedditSearch(q, "year", 25);
    return { ok: true, ticket: makeTicket(runId, user.id, "lsearch") };
  } catch (e) {
    return fail(e, "search");
  }
}

export async function launchCheckSearch(ticket: string): Promise<{ ok: true; done: false } | { ok: true; done: true; hits: ThreadHit[] } | Fail> {
  const { user } = await signedIn();
  if (!user) return { ok: false, message: "Please sign in again." };
  const runId = readTicket(ticket, user.id, "lsearch");
  if (!runId) return { ok: false, message: "This search can’t be read." };
  try {
    const run = await getRun(runId);
    if (run.status === "READY" || run.status === "RUNNING") return { ok: true, done: false };
    if (run.status !== "SUCCEEDED") return { ok: false, message: `The Reddit search ${run.status.toLowerCase()}.` };
    const hits = mapRedditSearchItems(await getDatasetItems(run.datasetId, 50));
    return { ok: true, done: true, hits: hits.map((h) => ({ url: h.url, title: h.title, community: h.community, comments: h.comments })) };
  } catch (e) {
    if (e instanceof ApifyError && e.kind === "rate_limit") return { ok: true, done: false };
    return fail(e, "search check");
  }
}

// 3. Pick the most useful threads.
export async function launchChoose(input: LaunchInput, hits: ThreadHit[]): Promise<{ ok: true; threads: ThreadHit[] } | Fail> {
  const { user } = await signedIn();
  if (!user) return { ok: false, message: "Please sign in again." };
  const i = cleanInput(input);
  if (!i) return { ok: false, message: "Missing product." };
  const safe = (Array.isArray(hits) ? hits : [])
    .slice(0, 60)
    .map((h): ThreadHit | null => {
      const p = parseRedditUrl(String(h?.url ?? ""));
      return p.ok ? { url: p.canonicalUrl, title: s(h.title, 200), community: h.community ? s(h.community, 60) : null, comments: Number(h.comments) || 0 } : null;
    })
    .filter((h): h is ThreadHit => Boolean(h));
  const unique = [...new Map(safe.map((h) => [h.url, h])).values()];
  try {
    return { ok: true, threads: await chooseThreads(i, unique, 4) };
  } catch (e) {
    return fail(e, "choose");
  }
}

// 4. Collect comments: one Reddit run for the chosen threads + one run per competitor Instagram post.
export async function launchCollect(
  redditUrls: string[],
  instagramUrls: string[],
): Promise<{ ok: true; jobs: { ticket: string; source: "reddit" | "instagram"; label: string }[]; warnings: string[] } | Fail> {
  const { user } = await signedIn();
  if (!user) return { ok: false, message: "Please sign in again." };
  const reddit = [...new Set((redditUrls ?? []).slice(0, 4).map((u) => parseRedditUrl(String(u))).filter((p) => p.ok).map((p) => (p.ok ? p.canonicalUrl : "")))];
  const ig = [
    ...new Set(
      (instagramUrls ?? [])
        .slice(0, 3)
        .map((u) => parseInstagramUrl(String(u)))
        .filter((p) => p.ok)
        .map((p) => (p.ok ? p.canonicalUrl : "")),
    ),
  ];
  const jobs: { ticket: string; source: "reddit" | "instagram"; label: string }[] = [];
  const warnings: string[] = [];
  if (reddit.length) {
    try {
      const { runId } = await startRedditRunMany(reddit, PER_THREAD);
      jobs.push({ ticket: makeTicket(runId, user.id, "lcollect-reddit"), source: "reddit", label: `${reddit.length} Reddit threads` });
    } catch (e) {
      warnings.push(`Reddit comments couldn’t be collected: ${e instanceof ApifyError ? e.message : "error"}`);
    }
  }
  for (const url of ig) {
    try {
      const { runId } = await startCommentRun(url, PER_POST);
      jobs.push({ ticket: makeTicket(runId, user.id, "lcollect-instagram"), source: "instagram", label: "Instagram post" });
    } catch (e) {
      warnings.push(`An Instagram post couldn’t be collected: ${e instanceof ApifyError ? e.message : "error"}`);
    }
  }
  if (!jobs.length) return { ok: false, message: warnings[0] ?? "Nothing to collect." };
  return { ok: true, jobs, warnings };
}

export async function launchCheckCollect(
  ticket: string,
  source: "reddit" | "instagram",
): Promise<{ ok: true; done: false } | { ok: true; done: true; texts: string[] } | Fail> {
  const { user } = await signedIn();
  if (!user) return { ok: false, message: "Please sign in again." };
  const runId = readTicket(ticket, user.id, source === "reddit" ? "lcollect-reddit" : "lcollect-instagram");
  if (!runId) return { ok: false, message: "This collection can’t be read." };
  try {
    const run = await getRun(runId);
    if (run.status === "READY" || run.status === "RUNNING") return { ok: true, done: false };
    if (run.status !== "SUCCEEDED") return { ok: true, done: true, texts: [] }; // skip a failed source, keep going
    const items = await getDatasetItems(run.datasetId, source === "reddit" ? 4 * (PER_THREAD + 1) : PER_POST);
    // Privacy: only the comment text is kept, with @mentions / u/names hidden. No usernames.
    const texts =
      source === "reddit"
        ? mapApifyRedditItems(items, 4 * PER_THREAD).comments.map((c) => c.text)
        : mapApifyItems(items).comments.map((c) => maskMentions(c.text));
    return { ok: true, done: true, texts: texts.filter((t) => t.trim().length > 3).map((t) => t.slice(0, 400)) };
  } catch (e) {
    if (e instanceof ApifyError && e.kind === "rate_limit") return { ok: true, done: false };
    return fail(e, "collect check");
  }
}

// 5. Ask an AI assistant a shopper question.
export async function launchAskAI(brand: string, question: string): Promise<{ ok: true; check: AiCheck } | Fail> {
  const { user } = await signedIn();
  if (!user) return { ok: false, message: "Please sign in again." };
  const q = s(question, 200);
  if (q.length < 8) return { ok: false, message: "Empty question." };
  try {
    const ans = await askAssistant(q);
    const j = await judgeAnswer(s(brand, 80) || "the launching brand", q, ans.text);
    const named = [...new Set([...(j.mentioned && brand ? [brand] : []), ...j.competitors])].slice(0, 8);
    return {
      ok: true,
      check: {
        question: q,
        brandMentioned: j.mentioned,
        recommended: named,
        description: j.description,
        sources: ans.sources.slice(0, 6),
      },
    };
  } catch (e) {
    if (e instanceof AiError && e.kind !== "other") return fail(e, "ask");
    return { ok: true, check: { question: q, brandMentioned: false, recommended: [], description: "", sources: [], error: "This question failed." } };
  }
}

// 6. Write the plan.
export async function launchWrite(
  input: LaunchInput,
  comments: { text: string; source: "reddit" | "instagram" }[],
  checks: AiCheck[],
): Promise<{ ok: true; report: LaunchReport } | Fail> {
  const { user } = await signedIn();
  if (!user) return { ok: false, message: "Please sign in again." };
  const i = cleanInput(input);
  if (!i) return { ok: false, message: "Missing product." };
  // Prefer longer, question-like comments; cap the sample.
  const score = (t: string) => (t.includes("?") ? 3 : 0) + Math.min(3, Math.floor(t.length / 60));
  const picked: LaunchComment[] = (Array.isArray(comments) ? comments : [])
    .slice(0, 2000)
    .map((c) => ({ text: s(c?.text, 400), source: c?.source === "instagram" ? ("instagram" as const) : ("reddit" as const) }))
    .filter((c) => c.text.length > 3)
    .sort((a, b) => score(b.text) - score(a.text))
    .slice(0, 300)
    .map((c, idx) => ({ ref: `c${idx + 1}`, ...c }));
  const safeChecks = (Array.isArray(checks) ? checks : []).slice(0, 5);
  try {
    return { ok: true, report: await writeLaunchReport(i, picked, safeChecks) };
  } catch (e) {
    return fail(e, "write");
  }
}

// ---------- saved plans ----------

export type SavedLaunch = { id: string; product: string; market: string; created_at: string };
const SETUP = "Saving launch plans needs a one-time database update: run 013_launch_plans.sql in Supabase.";

export async function saveLaunch(
  input: LaunchInput,
  data: { plan: LaunchResearchPlan | null; threads: ThreadHit[]; checks: AiCheck[] },
  report: LaunchReport,
): Promise<{ ok: true; id: string } | Fail> {
  const { supabase, user } = await signedIn();
  if (!user) return { ok: false, message: "Please sign in again." };
  const i = cleanInput(input);
  if (!i) return { ok: false, message: "Nothing to save." };
  const { data: row, error } = await supabase
    .from("launch_plans")
    .insert({ product: i.product, market: i.market, input: i, research: data, report })
    .select("id")
    .single();
  if (error) {
    if (/launch_plans|schema cache|does not exist/i.test(error.message)) return { ok: false, message: SETUP };
    console.error("[polarvane] save launch failed:", error);
    return { ok: false, message: "Couldn’t save this plan." };
  }
  return { ok: true, id: row.id as string };
}

export async function listLaunches(): Promise<SavedLaunch[]> {
  const { supabase, user } = await signedIn();
  if (!user) return [];
  const { data, error } = await supabase
    .from("launch_plans")
    .select("id, product, market, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  return error ? [] : ((data ?? []) as SavedLaunch[]);
}

export async function openLaunch(
  id: string,
): Promise<{ ok: true; input: LaunchInput; research: { plan: LaunchResearchPlan | null; threads: ThreadHit[]; checks: AiCheck[] }; report: LaunchReport } | Fail> {
  const { supabase, user } = await signedIn();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Plan not found." };
  const { data } = await supabase.from("launch_plans").select("input, research, report").eq("id", id).maybeSingle();
  if (!data) return { ok: false, message: "Plan not found." };
  return { ok: true, input: data.input as LaunchInput, research: data.research as never, report: data.report as LaunchReport };
}

export async function deleteLaunch(id: string): Promise<{ ok: boolean }> {
  const { supabase, user } = await signedIn();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
  const { error } = await supabase.from("launch_plans").delete().eq("id", id);
  return { ok: !error };
}
