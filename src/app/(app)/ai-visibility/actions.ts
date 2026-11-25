"use server";

import { AiError } from "@/lib/ai";
import { loadComments } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";
import { askAssistant, judgeAnswer, suggestQuestions, type Source, type SuggestedQuestion } from "@/lib/visibility";

const UUID = /^[0-9a-f-]{36}$/i;

export type CheckRow = {
  id: string;
  run_id: string;
  brand: string;
  question: string;
  model: string;
  web_search: boolean;
  answer: string;
  mentioned: boolean;
  rank: number | null;
  sentiment: "positive" | "neutral" | "negative" | "not_mentioned" | null;
  description: string | null;
  competitors: string[];
  sources: Source[];
  created_at: string;
};

const TABLE_MISSING =
  "Results can’t be saved yet. Run the AI visibility setup script (008_ai_visibility.sql) in Supabase.";

function errorMessage(e: unknown) {
  if (e instanceof AiError) return e.message;
  console.error("[polarvane] ai visibility error:", e);
  return "Something went wrong. Please try again.";
}

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Suggests questions to test, based on what customers ask in the analyzed comments.
export async function suggestFromComments(
  dashboardId: string,
  brand: string,
  product: string,
): Promise<{ ok: true; questions: SuggestedQuestion[]; used: number } | { ok: false; message: string }> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  brand = brand.trim().slice(0, 80);
  product = product.trim().slice(0, 80);
  if (!brand) return { ok: false, message: "Enter the brand name first." };

  try {
    let ids: string[] | undefined;
    if (dashboardId && UUID.test(dashboardId)) {
      const { data } = await supabase
        .from("analyses")
        .select("id")
        .eq("status", "completed")
        .eq("dashboard_id", dashboardId);
      ids = (data ?? []).map((a) => a.id as string);
    }
    const { rows } = await loadComments(supabase, undefined, ids);
    if (rows.length === 0) return { ok: false, message: "No analyzed comments yet. Analyze a post first." };

    // Prefer comments that ask something or talk about the product.
    const score = (r: (typeof rows)[number]) =>
      (r.text.includes("?") ? 3 : 0) +
      (r.focus === "product" || r.focus === "both" ? 2 : 0) +
      (r.topics?.some((t) => ["questions", "products", "support", "criticism"].includes(t)) ? 1 : 0) +
      (r.text.length > 25 ? 1 : 0);
    const picked = [...rows]
      .filter((r) => r.text.trim().length > 3)
      .sort((a, b) => score(b) - score(a))
      .slice(0, 300)
      .map((r) => r.text);

    const questions = await suggestQuestions(brand, product, picked);
    if (questions.length === 0)
      return { ok: false, message: "No clear recurring customer questions were found. Try typing your own questions." };
    return { ok: true, questions, used: picked.length };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}

// Asks the AI assistant one question and records whether the brand appeared.
export async function runCheck(
  runId: string,
  brand: string,
  question: string,
): Promise<{ ok: true; row: CheckRow; warning?: string } | { ok: false; message: string }> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  brand = brand.trim().slice(0, 80);
  question = question.trim().slice(0, 300);
  if (!UUID.test(runId) || !brand || !question) return { ok: false, message: "Missing brand or question." };

  try {
    const answer = await askAssistant(question);
    const judged = await judgeAnswer(brand, question, answer.text);
    const record = {
      run_id: runId,
      brand,
      question,
      model: answer.model,
      web_search: answer.webSearch,
      answer: answer.text,
      mentioned: judged.mentioned,
      rank: judged.rank,
      sentiment: judged.sentiment,
      description: judged.description,
      competitors: judged.competitors,
      sources: answer.sources,
    };
    const { data, error } = await supabase.from("ai_visibility_checks").insert(record).select("*").single();
    if (error) {
      console.error("[polarvane] save visibility check failed:", error.message);
      return {
        ok: true,
        row: { ...record, id: crypto.randomUUID(), created_at: new Date().toISOString() },
        warning: /does not exist|could not find the table|schema cache/i.test(error.message)
          ? TABLE_MISSING
          : "This result couldn’t be saved.",
      };
    }
    return { ok: true, row: data as CheckRow };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}

export async function deleteRun(runId: string): Promise<void> {
  if (!UUID.test(runId)) return;
  const { supabase, user } = await getUser();
  if (!user) return;
  await supabase.from("ai_visibility_checks").delete().eq("run_id", runId);
}
