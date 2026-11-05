"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

async function auth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createDashboard(
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const clean = (name ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return { ok: false, message: "Please give the dashboard a name." };
  if (clean.length > 80) return { ok: false, message: "Please keep the name under 80 characters." };
  const { supabase, user } = await auth();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again." };
  const { data, error } = await supabase
    .from("dashboards")
    .insert({ user_id: user.id, name: clean })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      message: /does not exist|schema cache/i.test(error.message)
        ? "Dashboards need the database update (part 5) in Supabase."
        : "Couldn’t create the dashboard. Please try again.",
    };
  }
  refresh();
  return { ok: true, id: data.id as string };
}

export async function deleteDashboard(id: string): Promise<{ ok: boolean }> {
  if (!UUID.test(id)) return { ok: false };
  const { supabase, user } = await auth();
  if (!user) return { ok: false };
  // Posts are kept; they simply become "not in a dashboard".
  await supabase.from("dashboards").delete().eq("id", id);
  refresh();
  return { ok: true };
}

export async function moveToDashboard(analysisId: string, dashboardId: string): Promise<{ ok: boolean; message?: string }> {
  if (!UUID.test(analysisId) || (dashboardId && !UUID.test(dashboardId))) return { ok: false, message: "Invalid request." };
  const { supabase, user } = await auth();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again." };
  const { error } = await supabase
    .from("analyses")
    .update({ dashboard_id: dashboardId || null })
    .eq("id", analysisId);
  if (error) return { ok: false, message: "Couldn’t move the post. Please try again." };
  refresh();
  return { ok: true };
}
