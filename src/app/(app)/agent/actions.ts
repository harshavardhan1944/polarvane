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
