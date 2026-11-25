"use server";

import { AiError } from "@/lib/ai";
import { generateAdBrief, type AdBrief } from "@/lib/adbrief";
import { checkAdCopy, type CopyCheck } from "@/lib/copycheck";
import { loadComments } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_COMMENTS = 250;

// Writes an ad brief from the comments on the chosen posts.
export async function makeBrief(postIds: string[]): Promise<{ ok: true; brief: AdBrief } | { ok: false; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const ids = [...new Set(postIds.filter((id) => UUID.test(id)))].slice(0, 20);
  if (ids.length === 0) return { ok: false, message: "Choose at least one post." };

  try {
    const { data: posts } = await supabase.from("analyses").select("id, caption").in("id", ids);
    const captions = (posts ?? []).map((p) => (p.caption as string | null) ?? "");
    const { rows } = await loadComments(supabase, undefined, ids);
    if (rows.length === 0) return { ok: false, message: "These posts have no analyzed comments yet." };

    // Prefer comments that ask something, talk about the product, or raise a problem.
    const score = (r: (typeof rows)[number]) =>
      (r.text.includes("?") ? 3 : 0) +
      (r.focus === "product" || r.focus === "both" ? 2 : 0) +
      (r.sentiment === "negative" ? 2 : 0) +
      (r.text.length > 25 ? 1 : 0);
    const picked = [...rows]
      .filter((r) => r.text.trim().length > 3)
      .sort((a, b) => score(b) - score(a))
      .slice(0, MAX_COMMENTS)
      .map((r, i) => ({ ref: `c${i + 1}`, text: r.text }));

    const brief = await generateAdBrief(captions, picked);
    if (!brief.hooks.length && !brief.doubts.length)
      return { ok: false, message: "The comments didn’t contain enough clear signals for a brief. Try adding more posts." };
    return { ok: true, brief };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, message: e.message };
    console.error("[polarvane] ad brief failed:", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

// Checks a draft ad's lines against the comments on the chosen posts.
export async function checkCopy(
  postIds: string[],
  copy: string,
): Promise<{ ok: true; check: CopyCheck } | { ok: false; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const text = String(copy ?? "").trim().slice(0, 2000);
  if (text.length < 5) return { ok: false, message: "Paste the ad text you want to check." };
  const ids = [...new Set(postIds.filter((id) => UUID.test(id)))].slice(0, 20);
  if (ids.length === 0) return { ok: false, message: "Choose at least one post to check against." };

  try {
    const { rows } = await loadComments(supabase, undefined, ids);
    if (rows.length === 0) return { ok: false, message: "These posts have no analyzed comments yet." };
    const score = (r: (typeof rows)[number]) =>
      (r.text.includes("?") ? 3 : 0) +
      (r.focus === "product" || r.focus === "both" ? 2 : 0) +
      (r.sentiment === "negative" ? 2 : 0) +
      (r.sentiment === "positive" && r.text.length > 25 ? 1 : 0) +
      (r.text.length > 25 ? 1 : 0);
    const picked = [...rows]
      .filter((r) => r.text.trim().length > 3)
      .sort((a, b) => score(b) - score(a))
      .slice(0, MAX_COMMENTS)
      .map((r, i) => ({ ref: `c${i + 1}`, text: r.text }));

    const check = await checkAdCopy(text, picked);
    if (!check.flags.length) return { ok: false, message: "Couldn’t find any lines to check. Try pasting the full ad text." };
    return { ok: true, check };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, message: e.message };
    console.error("[polarvane] copy check failed:", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
