"use server";

import { AiError } from "@/lib/ai";
import { loadComments } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { askTalon, type ChatTurn, type TalonEvidence } from "@/lib/talon";

export type TalonReply =
  | { ok: true; answer: string; evidence: TalonEvidence[]; total: number; sampled: boolean }
  | { ok: false; message: string };

export async function sendToTalon(question: string, history: ChatTurn[], postId: string): Promise<TalonReply> {
  const q = (question ?? "").trim();
  if (!q) return { ok: false, message: "Please type a question." };
  if (q.length > 1000) return { ok: false, message: "Please keep questions under 1,000 characters." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again." };

  let scopeLabel = "all analyzed posts";
  if (postId) {
    if (!/^[0-9a-f-]{36}$/i.test(postId)) return { ok: false, message: "Invalid post." };
    const { data: a } = await supabase.from("analyses").select("shortcode, post_type").eq("id", postId).maybeSingle();
    if (!a) return { ok: false, message: "Post not found." };
    scopeLabel = `one ${a.post_type === "reel" ? "Reel" : "post"} (${a.shortcode})`;
  }

  let rows;
  try {
    ({ rows } = await loadComments(supabase, postId || undefined));
  } catch (e) {
    console.error("[polarvane] talon load failed:", e);
    return { ok: false, message: "Couldn’t load your comments. Please try again." };
  }
  if (rows.length === 0)
    return {
      ok: false,
      message: "There are no analyzed comments yet. Analyze a post first, then ask Talon about it.",
    };

  const safeHistory = (Array.isArray(history) ? history : [])
    .filter((t) => t && (t.role === "user" || t.role === "talon") && typeof t.text === "string")
    .slice(-6);

  try {
    const r = await askTalon(rows, q, safeHistory, scopeLabel);
    if (!r.answer) return { ok: false, message: "Talon couldn’t form an answer. Please rephrase and try again." };
    return { ok: true, ...r };
  } catch (err) {
    console.error("[polarvane] talon failed:", err);
    return { ok: false, message: err instanceof AiError ? err.message : "Talon hit an error. Please try again." };
  }
}
