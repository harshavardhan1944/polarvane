"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { scanAll } from "@/lib/sources/connectors";
import { analyzeMentions, rankSources, type MentionRow } from "@/lib/sources/engine";

export type ScanState = { status: "idle" } | { status: "error"; message: string };

const UUID = /^[0-9a-f-]{36}$/i;

function dbMessage(message: string) {
  if (/relation .* does not exist|could not find the table|schema cache/i.test(message))
    return "The database isn’t set up for Find sources yet. Run supabase/migrations/008_source_scans.sql in Supabase’s SQL editor.";
  return "Couldn’t save the scan. Please try again in a moment.";
}

export async function startScan(_prev: ScanState, formData: FormData): Promise<ScanState> {
  const brand = String(formData.get("brand") ?? "").replace(/\s+/g, " ").trim();
  const market = String(formData.get("market") ?? "").replace(/\s+/g, " ").trim();
  const paid = formData.get("paid") === "on";
  if (brand.length < 2 || brand.length > 80) return { status: "error", message: "Enter a brand name (2–80 characters)." };
  if (market.length > 60) return { status: "error", message: "Keep the market short, e.g. “India” or “Bengaluru”." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Your session has expired. Please sign in again." };

  // Protect against runaway Apify costs: one scan at a time per user.
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { count: running, error: countErr } = await supabase
    .from("source_scans")
    .select("id", { count: "exact", head: true })
    .eq("status", "scanning")
    .gte("created_at", since);
  if (countErr) return { status: "error", message: dbMessage(countErr.message) };
  if ((running ?? 0) > 0) return { status: "error", message: "A scan is already running. Please wait for it to finish." };

  const { data: scan, error: insErr } = await supabase
    .from("source_scans")
    .insert({ user_id: user.id, brand, market, status: "scanning" })
    .select("id")
    .single();
  if (insErr || !scan) return { status: "error", message: dbMessage(insErr?.message ?? "") };

  try {
    const results = await scanAll({ brand, market, paid });
    const { index, selected } = rankSources(results);

    const { error: srcErr } = await supabase.from("scan_sources").insert(
      results.map((r) => ({
        scan_id: scan.id,
        user_id: user.id,
        name: r.name,
        type: r.type,
        status: r.status,
        engagement_count: Math.round(r.engagement_count),
        unit: r.unit,
        avg_rating: r.avg_rating,
        where_list: r.where_list,
        note: r.note,
        rank_index: index.get(r.name) ?? 0,
      })),
    );
    if (srcErr) throw new Error(srcErr.message);

    const mentions = results.flatMap((r) =>
      r.mentions.map((m) => ({ ...m, text: m.text.slice(0, 4000), scan_id: scan.id, user_id: user.id })),
    );
    for (let i = 0; i < mentions.length; i += 500) {
      const { error } = await supabase.from("scan_mentions").insert(mentions.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }

    await supabase
      .from("source_scans")
      .update({ status: "ranked", selected_sources: [...selected] })
      .eq("id", scan.id);
  } catch (err) {
    console.error("[polarvane] scan failed:", err);
    await supabase
      .from("source_scans")
      .update({ status: "failed", error_message: "The scan couldn’t be saved. Please try again." })
      .eq("id", scan.id);
    return { status: "error", message: "The scan couldn’t be saved. Please try again." };
  }

  redirect(`/sources/${scan.id}`);
}

export type AnalyzeScanResult = { ok: true } | { ok: false; message: string };

export async function analyzeScan(id: string, sourceNames: string[]): Promise<AnalyzeScanResult> {
  if (!UUID.test(id)) return { ok: false, message: "Invalid request." };
  const names = [...new Set(sourceNames.map(String))].slice(0, 10);
  if (!names.length) return { ok: false, message: "Pick at least one source." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again." };

  const { data: scan } = await supabase.from("source_scans").select("id, brand, status").eq("id", id).maybeSingle();
  if (!scan) return { ok: false, message: "Scan not found." };

  // Claim it so a double-click can't run two analyses.
  const { data: claimed } = await supabase
    .from("source_scans")
    .update({ status: "analyzing", error_message: null })
    .eq("id", id)
    .in("status", ["ranked", "analyzed", "failed"])
    .select("id");
  if (!claimed?.length) return { ok: false, message: "This scan is already being analyzed." };

  try {
    const { data: srcRows } = await supabase
      .from("scan_sources")
      .select("name, engagement_count, unit, avg_rating")
      .eq("scan_id", id)
      .in("name", names);
    const { data: rows, error } = await supabase
      .from("scan_mentions")
      .select("id, scan_id, user_id, source, text, url, posted_at, rating, sentiment, theme")
      .eq("scan_id", id)
      .in("source", names)
      .limit(1200);
    if (error) throw new Error(error.message);

    const sources = (srcRows ?? []).map((r) => ({ ...r, engagement_count: Number(r.engagement_count) }));
    const mentionRows = (rows ?? []) as (MentionRow & { scan_id: string; user_id: string })[];
    const analysis = await analyzeMentions(scan.brand, sources, mentionRows);

    // Save each mention's label so other features (e.g. Talon) can use them later.
    for (let i = 0; i < mentionRows.length; i += 500) {
      const { error: upErr } = await supabase.from("scan_mentions").upsert(mentionRows.slice(i, i + 500));
      if (upErr) console.error("[polarvane] saving mention labels failed:", upErr);
    }

    await supabase
      .from("source_scans")
      .update({ status: "analyzed", analysis, selected_sources: names })
      .eq("id", id);
    refresh();
    return { ok: true };
  } catch (err) {
    console.error("[polarvane] analyze scan failed:", err);
    await supabase
      .from("source_scans")
      .update({ status: "ranked", error_message: "Analysis failed. Please try again." })
      .eq("id", id);
    refresh();
    return { ok: false, message: "Analysis failed. Please try again." };
  }
}

export async function deleteScan(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("source_scans").delete().eq("id", id);
  if (error) console.error("[polarvane] scan delete failed:", error);
  redirect("/sources");
}
