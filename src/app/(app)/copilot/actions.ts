"use server";

import { AiError } from "@/lib/ai";
import { loadComments } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { askTalon, type ChatTurn, type TalonEvidence } from "@/lib/talon";

export type TalonReply =
  | {
      ok: true;
      answer: string;
      evidence: TalonEvidence[];
      total: number;
      sampled: boolean;
      chatId: string | null;
      historyWarning?: string;
    }
  | { ok: false; message: string; chatId: string | null; historyWarning?: string };

export type ChatSummary = { id: string; title: string; updated_at: string };

export type StoredMessage =
  | { role: "user"; text: string }
  | { role: "talon"; text: string; evidence: TalonEvidence[]; total: number; sampled: boolean }
  | { role: "error"; text: string };

const UUID = /^[0-9a-f-]{36}$/i;
const HISTORY_MISSING =
  "Chat history isn’t set up yet, so this conversation won’t be saved. Run the Talon history setup script in Supabase.";

function isMissingTable(message: string | undefined) {
  return Boolean(message && /does not exist|could not find the table|schema cache/i.test(message));
}

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function listChats(): Promise<ChatSummary[]> {
  const { supabase, user } = await getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("talon_chats")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  return (data ?? []) as ChatSummary[];
}

export async function loadChat(chatId: string): Promise<{ postId: string; messages: StoredMessage[] } | null> {
  if (!UUID.test(chatId)) return null;
  const { supabase, user } = await getUser();
  if (!user) return null;
  const { data: chat } = await supabase.from("talon_chats").select("id, post_id").eq("id", chatId).maybeSingle();
  if (!chat) return null;
  const { data } = await supabase
    .from("talon_messages")
    .select("role, text, evidence, meta")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);
  const messages: StoredMessage[] = (data ?? []).map((m) =>
    m.role === "talon"
      ? {
          role: "talon",
          text: m.text,
          evidence: (m.evidence ?? []) as TalonEvidence[],
          total: Number(m.meta?.total ?? 0),
          sampled: Boolean(m.meta?.sampled),
        }
      : { role: m.role as "user" | "error", text: m.text },
  );
  return { postId: (chat.post_id as string | null) ?? "", messages };
}

export async function deleteChat(chatId: string) {
  if (!UUID.test(chatId)) return;
  const { supabase, user } = await getUser();
  if (!user) return;
  await supabase.from("talon_chats").delete().eq("id", chatId);
}

export async function sendToTalon(question: string, chatIdIn: string | null, postId: string): Promise<TalonReply> {
  const q = (question ?? "").trim();
  if (!q) return { ok: false, message: "Please type a question.", chatId: chatIdIn };
  if (q.length > 1000) return { ok: false, message: "Please keep questions under 1,000 characters.", chatId: chatIdIn };

  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again.", chatId: chatIdIn };

  let scopeLabel = "all analyzed posts";
  if (postId) {
    if (!UUID.test(postId)) return { ok: false, message: "Invalid post.", chatId: chatIdIn };
    const { data: a } = await supabase.from("analyses").select("shortcode, post_type").eq("id", postId).maybeSingle();
    if (!a) return { ok: false, message: "Post not found.", chatId: chatIdIn };
    scopeLabel = `one ${a.post_type === "reel" ? "Reel" : "post"} (${a.shortcode})`;
  }

  // ---- Save the question (history is optional: never block the answer) ----
  let chatId: string | null = chatIdIn && UUID.test(chatIdIn) ? chatIdIn : null;
  let historyWarning: string | undefined;
  let history: ChatTurn[] = [];

  if (chatId) {
    const { data: prev, error } = await supabase
      .from("talon_messages")
      .select("role, text")
      .eq("chat_id", chatId)
      .neq("role", "error")
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) chatId = null;
    else history = (prev ?? []).reverse().map((m) => ({ role: m.role as "user" | "talon", text: m.text }));
  }
  if (!chatId) {
    const { data: chat, error } = await supabase
      .from("talon_chats")
      .insert({ user_id: user.id, title: q.slice(0, 80), post_id: postId || null })
      .select("id")
      .single();
    if (error) historyWarning = isMissingTable(error.message) ? HISTORY_MISSING : "This chat couldn’t be saved.";
    else chatId = chat.id as string;
  }
  const save = async (row: { role: string; text: string; evidence?: unknown; meta?: unknown }) => {
    if (!chatId) return;
    await supabase.from("talon_messages").insert({ chat_id: chatId, user_id: user.id, ...row });
    await supabase.from("talon_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
  };
  await save({ role: "user", text: q });

  // ---- Answer ----
  let rows;
  try {
    ({ rows } = await loadComments(supabase, postId || undefined));
  } catch (e) {
    console.error("[polarvane] talon load failed:", e);
    const message = "Couldn’t load your comments. Please try again.";
    await save({ role: "error", text: message });
    return { ok: false, message, chatId, historyWarning };
  }
  if (rows.length === 0) {
    const message = "There are no analyzed comments yet. Analyze a post first, then ask Talon about it.";
    await save({ role: "error", text: message });
    return { ok: false, message, chatId, historyWarning };
  }

  try {
    const r = await askTalon(rows, q, history, scopeLabel);
    if (!r.answer) {
      const message = "Talon couldn’t form an answer. Please rephrase and try again.";
      await save({ role: "error", text: message });
      return { ok: false, message, chatId, historyWarning };
    }
    await save({ role: "talon", text: r.answer, evidence: r.evidence, meta: { total: r.total, sampled: r.sampled } });
    return { ok: true, ...r, chatId, historyWarning };
  } catch (err) {
    console.error("[polarvane] talon failed:", err);
    const message = err instanceof AiError ? err.message : "Talon hit an error. Please try again.";
    await save({ role: "error", text: message });
    return { ok: false, message, chatId, historyWarning };
  }
}
