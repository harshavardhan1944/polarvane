import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardItem = { id: string; name: string };

// Returns the user's named dashboards, or null if the dashboards database update isn't applied yet.
export async function listDashboards(supabase: SupabaseClient): Promise<DashboardItem[] | null> {
  const { data, error } = await supabase.from("dashboards").select("id, name").order("created_at", { ascending: true });
  if (error) return null;
  return (data ?? []) as DashboardItem[];
}

// Dashboards that contain at least one analyzed Reddit thread (for the Reddit pages).
export async function listRedditDashboards(supabase: SupabaseClient): Promise<DashboardItem[]> {
  const all = await listDashboards(supabase);
  if (!all?.length) return [];
  const { data, error } = await supabase
    .from("analyses")
    .select("dashboard_id")
    .eq("post_type", "reddit")
    .eq("status", "completed")
    .not("dashboard_id", "is", null);
  if (error) return [];
  const ids = new Set((data ?? []).map((r) => r.dashboard_id as string));
  return all.filter((d) => ids.has(d.id));
}

// Your own names for posts (id → title). Empty if the titles database update isn't applied yet.
export async function loadPostTitles(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("analyses").select("id, title").not("title", "is", null);
  if (error) return new Map();
  return new Map((data ?? []).map((r) => [r.id as string, r.title as string]));
}

export function postLabel(p: { id: string; post_type: string; shortcode: string }, titles: Map<string, string>) {
  return (
    titles.get(p.id) ??
    (p.post_type === "reddit"
      ? `Reddit thread · ${p.shortcode.replace("reddit_", "")}`
      : `${p.post_type === "reel" ? "Reel" : "Post"} · ${p.shortcode}`)
  );
}
