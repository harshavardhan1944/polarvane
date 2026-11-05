import { type NextRequest } from "next/server";
import { maskMentions } from "@/lib/privacy";
import { createClient } from "@/lib/supabase/server";

// Downloads analyzed comments as CSV. Signed-in users only; Row Level
// Security guarantees each user can export only their own data.
// Usernames are never included, and @mentions are masked.

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection and escape quotes.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Please sign in.", { status: 401 });

  const analysisId = request.nextUrl.searchParams.get("analysis") ?? "";
  if (analysisId && !/^[0-9a-f-]{36}$/i.test(analysisId)) return new Response("Invalid post.", { status: 400 });

  const { data: analyses } = await supabase.from("analyses").select("id, post_url, shortcode");
  const posts = new Map((analyses ?? []).map((a) => [a.id as string, a]));

  const header = ["post", "post_url", "comment", "sentiment", "confidence", "topics", "likes", "posted_at"];
  const lines = [header.map(csvCell).join(",")];

  for (let from = 0; from < 20000; from += 1000) {
    let q = supabase
      .from("comments")
      .select("analysis_id, text, sentiment, sentiment_confidence, topics, like_count, posted_at")
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (analysisId) q = q.eq("analysis_id", analysisId);
    const { data, error } = await q;
    if (error) return new Response("Couldn’t export right now. Please try again.", { status: 500 });
    for (const c of data ?? []) {
      const p = posts.get(c.analysis_id as string);
      lines.push(
        [
          p?.shortcode ?? "",
          p?.post_url ?? "",
          maskMentions(String(c.text ?? "")),
          c.sentiment ?? "not analyzed",
          c.sentiment_confidence ?? "",
          (c.topics ?? []).join("; "),
          c.like_count ?? "",
          c.posted_at ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
    if (!data || data.length < 1000) break;
  }

  const name = analysisId && posts.get(analysisId) ? `polarvane-${posts.get(analysisId)!.shortcode}` : "polarvane-all-comments";
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
