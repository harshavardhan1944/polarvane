"use server";

import { refresh } from "next/cache";
import { parseInstagramUrl } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

export type CreateAnalysisState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "duplicate"; message: string }
  | { status: "created"; message: string };

function dbErrorMessage(code: string | undefined, message: string) {
  if (code === "42P01" || /relation .* does not exist|could not find the table/i.test(message))
    return "The database isn’t set up yet. Please run the setup script in Supabase (Step 2 instructions).";
  if (code === "42501") return "Permission denied. Please sign out and sign in again.";
  return "Couldn’t save this analysis. Please try again in a moment.";
}

export async function createAnalysis(
  _prev: CreateAnalysisState,
  formData: FormData,
): Promise<CreateAnalysisState> {
  const parsed = parseInstagramUrl(String(formData.get("url") ?? ""));
  if (!parsed.ok) return { status: "error", message: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Your session has expired. Please sign in again." };

  // Duplicate check: has this user already added this post?
  const { data: existing, error: lookupError } = await supabase
    .from("analyses")
    .select("id, created_at")
    .eq("shortcode", parsed.shortcode)
    .maybeSingle();
  if (lookupError) {
    console.error("[polarvane] analyses lookup failed:", lookupError);
    return { status: "error", message: dbErrorMessage(lookupError.code, lookupError.message) };
  }
  if (existing) {
    return {
      status: "duplicate",
      message: "You’ve already added this post. It’s in your list below.",
    };
  }

  const { error: insertError } = await supabase.from("analyses").insert({
    user_id: user.id,
    post_url: parsed.canonicalUrl,
    shortcode: parsed.shortcode,
    post_type: parsed.postType,
    status: "queued",
  });
  if (insertError) {
    if (insertError.code === "23505")
      return { status: "duplicate", message: "You’ve already added this post. It’s in your list below." };
    console.error("[polarvane] analyses insert failed:", insertError);
    return { status: "error", message: dbErrorMessage(insertError.code, insertError.message) };
  }

  refresh();
  return {
    status: "created",
    message: `${parsed.postType === "reel" ? "Reel" : "Post"} saved. Comment collection will be switched on in the next step.`,
  };
}

export async function deleteAnalysis(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // Row Level Security guarantees users can only delete their own rows.
  const { error } = await supabase.from("analyses").delete().eq("id", id);
  if (error) console.error("[polarvane] analyses delete failed:", error);
  refresh();
}
