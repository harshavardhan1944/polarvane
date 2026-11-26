"use server";

import { AiError } from "@/lib/ai";
import { MAX_STEPS, nextStep, startAgent, writeReport, type AgentReport, type AgentState } from "@/lib/agent";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
type Fail = { ok: false; message: string };

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

function failure(e: unknown, what: string): Fail {
  if (e instanceof AiError) return { ok: false, message: e.message };
  console.error(`[polarvane] agent ${what} failed:`, e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

// The browser runs the agent one step per call, so each step shows up live
// and no single request runs too long.

export async function agentStart(goal: string, brand: string, dashboardId: string): Promise<{ ok: true; state: AgentState } | Fail> {
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Please sign in again." };
  const g = String(goal ?? "").trim().slice(0, 500);
  if (g.length < 8) return { ok: false, message: "Describe your goal in a sentence." };
  if (dashboardId && !UUID.test(dashboardId)) return { ok: false, message: "Unknown dashboard." };
  try {
    return { ok: true, state: await startAgent(supabase, g, String(brand ?? "").trim().slice(0, 80), dashboardId) };
  } catch (e) {
    return failure(e, "start");
  }
}

function validState(s: AgentState) {
  return (
    s &&
    typeof s.goal === "string" &&
    Array.isArray(s.steps) &&
    s.steps.length <= MAX_STEPS &&
    Array.isArray(s.posts) &&
    s.posts.length <= 30 &&
    (!s.dashboardId || UUID.test(s.dashboardId))
  );
}

export async function agentStep(state: AgentState): Promise<{ ok: true; state: AgentState; done: boolean } | Fail> {
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Please sign in again." };
  if (!validState(state)) return { ok: false, message: "This run can’t continue. Please start again." };
  try {
    return { ok: true, ...(await nextStep(supabase, state)) };
  } catch (e) {
    return failure(e, "step");
  }
}

export async function agentReport(state: AgentState): Promise<{ ok: true; report: AgentReport } | Fail> {
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Please sign in again." };
  if (!validState(state) || state.steps.length === 0) return { ok: false, message: "Nothing to report yet." };
  try {
    return { ok: true, report: await writeReport(state) };
  } catch (e) {
    return failure(e, "report");
  }
}

// ---------- saved plans ----------

export type SavedRun = { id: string; goal: string; created_at: string };
const SETUP = "Saving plans needs a one-time database update: run 012_agent_runs.sql in Supabase.";

export async function saveRun(state: AgentState, report: AgentReport): Promise<{ ok: true; id: string } | Fail> {
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Please sign in again." };
  if (!validState(state)) return { ok: false, message: "Nothing to save." };
  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      goal: state.goal.slice(0, 500),
      brand: state.brand || null,
      dashboard_id: state.dashboardId || null,
      state,
      report,
    })
    .select("id")
    .single();
  if (error) {
    if (/agent_runs|schema cache|does not exist/i.test(error.message)) return { ok: false, message: SETUP };
    console.error("[polarvane] save agent run failed:", error);
    return { ok: false, message: "Couldn’t save this plan." };
  }
  return { ok: true, id: data.id as string };
}

export async function listRuns(): Promise<SavedRun[]> {
  const supabase = await signedIn();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("agent_runs")
    .select("id, goal, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  return error ? [] : ((data ?? []) as SavedRun[]);
}

export async function openRun(id: string): Promise<{ ok: true; state: AgentState; report: AgentReport } | Fail> {
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Please sign in again." };
  if (!UUID.test(id)) return { ok: false, message: "Plan not found." };
  const { data } = await supabase.from("agent_runs").select("state, report").eq("id", id).maybeSingle();
  if (!data) return { ok: false, message: "Plan not found." };
  return { ok: true, state: data.state as AgentState, report: data.report as AgentReport };
}

export async function deleteRun(id: string): Promise<{ ok: boolean }> {
  const supabase = await signedIn();
  if (!supabase || !UUID.test(id)) return { ok: false };
  const { error } = await supabase.from("agent_runs").delete().eq("id", id);
  return { ok: !error };
}
