"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { refresh } from "next/cache";
import { ApifyError, getDatasetItems, getRun, startRedditSearch } from "@/lib/apify";
import { mapRedditSearchItems, parseRedditUrl, type RedditSearchHit } from "@/lib/reddit";
import { createClient } from "@/lib/supabase/server";
import { startCollection } from "./actions";

// Search Reddit by keyword (through Apify), then add the threads the user picks.

const TIMES = ["week", "month", "year", "all"] as const;
const MAX_POSTS = 25;
const LIMITS = [50, 200, 500, 1000];
type Fail = { ok: false; message: string };

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// The search ticket is signed so one user can't read another user's search run.
function sign(runId: string, userId: string) {
  return createHmac("sha256", `${process.env.APIFY_TOKEN ?? ""}:${userId}`).update(runId).digest("hex").slice(0, 32);
}
function verify(ticket: string, userId: string) {
  const [runId, sig] = String(ticket ?? "").split(".");
  if (!runId || !sig || !/^[A-Za-z0-9]{8,40}$/.test(runId)) return null;
  const want = Buffer.from(sign(runId, userId));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? runId : null;
}

export async function startSearch(query: string, time: string): Promise<{ ok: true; ticket: string } | Fail> {
  const { user } = await currentUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const q = String(query ?? "").replace(/\s+/g, " ").trim();
  if (q.length < 2 || q.length > 80) return { ok: false, message: "Type a brand or topic (2–80 characters)." };
  const t = (TIMES as readonly string[]).includes(time) ? time : "year";
  try {
    const { runId } = await startRedditSearch(q, t, MAX_POSTS);
    return { ok: true, ticket: `${runId}.${sign(runId, user.id)}` };
  } catch (e) {
    console.error("[polarvane] reddit search start failed:", e);
    return { ok: false, message: e instanceof ApifyError ? e.message : "Couldn’t start the search. Please try again." };
  }
}

export async function checkSearch(
  ticket: string,
): Promise<{ ok: true; status: "running" } | { ok: true; status: "done"; hits: RedditSearchHit[] } | Fail> {
  const { user } = await currentUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const runId = verify(ticket, user.id);
  if (!runId) return { ok: false, message: "This search can’t be read. Please search again." };
  try {
    const run = await getRun(runId);
    if (run.status === "READY" || run.status === "RUNNING") return { ok: true, status: "running" };
    if (run.status !== "SUCCEEDED")
      return { ok: false, message: `The Reddit search ${run.status.toLowerCase()}.${run.statusMessage ? ` ${run.statusMessage}` : ""}` };
    const items = await getDatasetItems(run.datasetId, MAX_POSTS * 2);
    return { ok: true, status: "done", hits: mapRedditSearchItems(items) };
  } catch (e) {
    if (e instanceof ApifyError && (e.kind === "rate_limit" || e.kind === "other")) return { ok: true, status: "running" };
    console.error("[polarvane] reddit search check failed:", e);
    return { ok: false, message: e instanceof ApifyError ? e.message : "Couldn’t read the search results." };
  }
}

export async function addThreads(
  urls: string[],
  dashboardId: string,
  limit: number,
): Promise<{ ok: true; added: number; started: number; skipped: number; note?: string } | Fail> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!LIMITS.includes(limit)) return { ok: false, message: "Choose how many comments to collect." };
  const picked = [...new Set((Array.isArray(urls) ? urls : []).slice(0, 10))]
    .map((u) => parseRedditUrl(String(u)))
    .filter((p) => p.ok);
  if (!picked.length) return { ok: false, message: "Tick at least one thread." };
  const dash = /^[0-9a-f-]{36}$/i.test(dashboardId) ? dashboardId : null;

  let added = 0;
  let started = 0;
  let skipped = 0;
  let note = "";
  for (const p of picked) {
    if (!p.ok) continue;
    const row: Record<string, string> = {
      user_id: user.id,
      post_url: p.canonicalUrl,
      shortcode: p.shortcode,
      post_type: "reddit",
      status: "queued",
    };
    let { data, error } = await supabase
      .from("analyses")
      .insert(dash ? { ...row, dashboard_id: dash } : row)
      .select("id")
      .maybeSingle();
    if (error && /dashboard_id|schema cache/i.test(error.message))
      ({ data, error } = await supabase.from("analyses").insert(row).select("id").maybeSingle());
    if (error) {
      if (error.code === "23505") {
        skipped++; // already added before
        continue;
      }
      if (error.code === "23514" || /post_type/i.test(error.message))
        return { ok: false, message: "Reddit needs a one-time database update: run 010_reddit.sql in Supabase." };
      console.error("[polarvane] add reddit thread failed:", error);
      return { ok: false, message: "Couldn’t save the threads. Please try again." };
    }
    added++;
    if (data?.id) {
      const res = await startCollection(data.id as string, limit);
      if (res.ok) started++;
      else note = res.message;
    }
  }
  refresh();
  return { ok: true, added, started, skipped, note: note || undefined };
}
