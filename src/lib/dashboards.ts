import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardItem = { id: string; name: string };

// Returns the user's named dashboards, or null if the dashboards database update isn't applied yet.
export async function listDashboards(supabase: SupabaseClient): Promise<DashboardItem[] | null> {
  const { data, error } = await supabase.from("dashboards").select("id, name").order("created_at", { ascending: true });
  if (error) return null;
  return (data ?? []) as DashboardItem[];
}
