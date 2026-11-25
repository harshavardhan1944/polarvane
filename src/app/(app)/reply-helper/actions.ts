"use server";

import { AiError } from "@/lib/ai";
import { draftReplies, loadQuestions, type ReplyPlan } from "@/lib/replies";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_QUESTIONS = 200;

// Drafts replies to the unanswered questions on a dashboard's posts ("" = all posts).
export async function makeReplies(dashboardId: string): Promise<{ ok: true; plan: ReplyPlan } | { ok: false; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (dashboardId && !UUID.test(dashboardId)) return { ok: false, message: "Unknown dashboard." };

  try {
    let q = supabase.from("analyses").select("id, caption").eq("status", "completed");
    if (dashboardId) q = q.eq("dashboard_id", dashboardId);
    const { data: posts, error } = await q.order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    if (!posts?.length) return { ok: false, message: "No analyzed posts here yet." };

    const all = await loadQuestions(supabase, posts.map((p) => p.id as string));
    const noReply = all.filter((r) => r.replies === 0);
    // If reply counts weren't collected, fall back to all questions.
    const pool = noReply.length ? noReply : all.filter((r) => r.replies === null);
    if (!pool.length) return { ok: false, message: "No unanswered questions found. Nice work!" };

    const plan = await draftReplies(
      posts.map((p) => (p.caption as string | null) ?? ""),
      pool.slice(0, MAX_QUESTIONS),
    );
    if (!plan.groups.length) return { ok: false, message: "Couldn’t find clear customer questions to reply to." };
    return { ok: true, plan };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, message: e.message };
    console.error("[polarvane] reply helper failed:", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
