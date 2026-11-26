"use server";

import { refresh } from "next/cache";
import { loadDemo, removeDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; dashboardId?: string | null; note?: string } | { ok: false; message: string };

export async function loadDemoBrand(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  try {
    const r = await loadDemo(supabase, user.id);
    refresh();
    return {
      ok: true,
      dashboardId: r.dashboardId,
      note: r.skippedReddit ? "The Reddit sample was skipped: run 010_reddit.sql in Supabase to include it." : undefined,
    };
  } catch (e) {
    console.error("[polarvane] demo load failed:", e);
    return { ok: false, message: "Couldn’t load the demo. Check that all database updates have been run in Supabase." };
  }
}

export async function removeDemoBrand(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  try {
    await removeDemo(supabase);
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[polarvane] demo remove failed:", e);
    return { ok: false, message: "Couldn’t remove the demo. Please try again." };
  }
}
