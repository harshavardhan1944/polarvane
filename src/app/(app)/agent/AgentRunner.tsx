"use client";

import { useRef, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, Download, History, Loader2, Quote, Square, Trash2, XCircle } from "lucide-react";
import type { AgentReport, AgentState } from "@/lib/agent";
import type { DashboardItem } from "@/lib/dashboards";
import { agentReport, agentStart, agentStep, deleteRun, openRun, saveRun, type SavedRun } from "./actions";

const EXAMPLES = [
  "Plan our next sunscreen ad",
  "Why are people unhappy, and what should we fix first?",
  "What should we reply to customers this week?",
  "Do AI assistants recommend us, and what should we change?",
];

function reportToText(goal: string, state: AgentState, r: AgentReport) {
  const lines = [`POLARVANE AGENT REPORT`, `Goal: ${goal}`, "", r.headline, "", r.summary, "", "WHAT WE FOUND"];
  r.findings.forEach((f) => {
    lines.push(`- ${f.text}`);
    if (f.quote) lines.push(`  Customer: "${f.quote}"`);
  });
  lines.push("", "PLAN");
  r.plan.forEach((p, i) => lines.push(`${i + 1}. ${p.action}`, `   Why: ${p.why}`));
  if (r.confirm.length) {
    lines.push("", "CONFIRM BEFORE ACTING");
    r.confirm.forEach((c) => lines.push(`- ${c}`));
  }
  lines.push("", "STEPS THE AGENT TOOK");
  state.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.label}: ${s.summary}`));
  if (r.limits) lines.push("", `Note: ${r.limits}`);
  return lines.join("\n");
}

export function AgentRunner({ dashboards, initialRuns = [] }: { dashboards: DashboardItem[]; initialRuns?: SavedRun[] }) {
  const [runs, setRuns] = useState<SavedRun[]>(initialRuns);
  const [saveNote, setSaveNote] = useState("");
  const [goal, setGoal] = useState("");
  const [brand, setBrand] = useState("");
  const [dashboardId, setDashboardId] = useState(dashboards[0]?.id ?? "");
  const [state, setState] = useState<AgentState | null>(null);
  const [report, setReport] = useState<AgentReport | null>(null);
  const [phase, setPhase] = useState<"" | "starting" | "working" | "writing">("");
  const [error, setError] = useState("");
  const stop = useRef(false);

  // Server calls can fail on a network hiccup or a server time limit; try once more before giving up.
  async function call<T>(fn: () => Promise<T>): Promise<T | { ok: false; message: string }> {
    for (let i = 0; i < 2; i++) {
      try {
        return await fn();
      } catch {
        if (i === 0) await new Promise((r) => setTimeout(r, 3000));
      }
    }
    return { ok: false, message: "The server took too long to answer (the AI service may be busy)." };
  }

  async function writePlan(s: AgentState, note = "") {
    setPhase("writing");
    setError(note);
    const rep = await call(() => agentReport(s));
    if (!rep.ok) {
      setError(`${rep.message} Your steps are kept; click “Write the plan again”.`);
      return;
    }
    setReport(rep.report);
    // Save every finished plan so it shows under "Past plans".
    const saved = await saveRun(s, rep.report).catch(() => null);
    if (saved?.ok) {
      setSaveNote("");
      setRuns((r) => [{ id: saved.id, goal: s.goal, created_at: new Date().toISOString() }, ...r].slice(0, 30));
    } else setSaveNote(saved?.message ?? "Couldn’t save this plan.");
  }

  async function run() {
    setError("");
    setReport(null);
    setState(null);
    if (goal.trim().length < 8) return setError("Describe your goal in a sentence.");
    stop.current = false;
    setPhase("starting");
    try {
      const started = await call(() => agentStart(goal, brand, dashboardId));
      if (!started.ok) throw new Error(started.message);
      let s = started.state;
      setState(s);
      setPhase("working");
      let note = "";
      for (let i = 0; i < 8 && !stop.current; i++) {
        const res = await call(() => agentStep(s));
        if (!res.ok) {
          if (!s.steps.length) throw new Error(res.message);
          // Keep what's done and write the plan from it.
          note = `A step didn’t finish (${res.message}). The plan below uses the ${s.steps.length} steps that did.`;
          break;
        }
        s = res.state;
        setState(s);
        if (res.done) break;
      }
      if (!s.steps.length) throw new Error("The agent stopped before running any step. Try rewording the goal.");
      await writePlan(s, note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPhase("");
    }
  }

  async function retryPlan() {
    if (!state) return;
    try {
      await writePlan(state);
    } finally {
      setPhase("");
    }
  }

  async function openPast(id: string) {
    if (phase) return;
    setError("");
    setSaveNote("");
    const r = await openRun(id);
    if (!r.ok) return setError(r.message);
    setGoal(r.state.goal);
    setBrand(r.state.brand ?? "");
    setState(r.state);
    setReport(r.report);
  }

  async function removePast(id: string) {
    const r = await deleteRun(id);
    if (r.ok) setRuns((list) => list.filter((x) => x.id !== id));
  }

  function download() {
    if (!state || !report) return;
    const blob = new Blob([reportToText(state.goal, state, report)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polarvane-agent-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const busy = phase !== "";

  return (
    <div className="space-y-6">
      <section className="panel space-y-4 p-5 sm:p-6">
        <div>
          <label className="mb-1 block text-xs text-muted">Your goal</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            maxLength={500}
            disabled={busy}
            placeholder="e.g. Plan our next sunscreen ad"
            className="w-full rounded-lg border border-navy-600 bg-navy-900 p-3 text-sm outline-none focus:border-brand-blue/60"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setGoal(ex)}
                disabled={busy}
                className="rounded-full border border-navy-600 px-3 py-1 text-xs text-muted hover:border-brand-blue/60 hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Brand name (for AI visibility checks)</label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              maxLength={80}
              disabled={busy}
              placeholder="e.g. Minimalist"
              className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm outline-none focus:border-brand-blue/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Which posts</label>
            <select
              value={dashboardId}
              onChange={(e) => setDashboardId(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm outline-none"
            >
              <option value="">All analyzed posts</option>
              {dashboards.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={run}
            disabled={busy}
            className="brand-gradient inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Bot size={15} />}
            {phase === "starting" ? "Getting ready…" : phase === "working" ? "Agent is working…" : phase === "writing" ? "Writing the plan…" : "Run agent"}
          </button>
          {phase === "working" && (
            <button
              onClick={() => (stop.current = true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 px-3 py-2 text-xs hover:bg-navy-800"
            >
              <Square size={12} /> Stop and write the plan
            </button>
          )}
        </div>
        {error && (
          <p className={`flex items-start gap-1.5 text-xs ${report ? "text-amber-200" : "text-red-300"}`}>
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        {!busy && state && state.steps.length > 0 && !report && (
          <button
            onClick={retryPlan}
            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 px-3 py-2 text-xs hover:bg-navy-800"
          >
            <Bot size={13} /> Write the plan again
          </button>
        )}
      </section>

      {state && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">What the agent did</h2>
          <ol className="space-y-2">
            {state.steps.map((s, i) => (
              <li key={i} className="panel flex gap-3 p-3">
                {s.error ? (
                  <XCircle size={16} className="mt-0.5 shrink-0 text-red-300" />
                ) : (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                )}
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="text-faint">{i + 1}.</span> {s.label}
                  </p>
                  {s.why && <p className="text-xs text-faint">Why: {s.why}</p>}
                  <p className={`mt-0.5 text-xs ${s.error ? "text-red-300" : "text-muted"}`}>{s.summary}</p>
                </div>
              </li>
            ))}
            {phase === "working" && (
              <li className="panel flex items-center gap-3 p-3 text-sm text-muted">
                <Loader2 size={16} className="animate-spin" /> Deciding the next step…
              </li>
            )}
          </ol>
        </section>
      )}

      {report && state && (
        <section className="panel space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-faint">Goal: {state.goal}</p>
              <h2 className="mt-1 font-display text-xl">{report.headline}</h2>
            </div>
            <button
              onClick={download}
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 px-3 py-2 text-sm hover:bg-navy-800"
            >
              <Download size={14} /> Download
            </button>
          </div>
          {report.summary && <p className="text-sm text-muted">{report.summary}</p>}

          {report.findings.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">What we found</h3>
              <ul className="space-y-2">
                {report.findings.map((f, i) => (
                  <li key={i} className="rounded-lg border border-navy-700 bg-navy-900 p-3">
                    <p className="text-sm">
                      {f.text}
                      {f.step && <span className="text-xs text-faint"> · step {f.step}</span>}
                    </p>
                    {f.quote && (
                      <p className="mt-1 flex gap-1.5 text-xs italic text-faint">
                        <Quote size={11} className="mt-0.5 shrink-0" /> {f.quote}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.plan.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">The plan</h3>
              <ol className="space-y-2">
                {report.plan.map((p, i) => (
                  <li key={i} className="flex gap-3 rounded-lg border border-navy-700 bg-navy-900 p-3">
                    <span className="font-display text-lg text-brand-blue">{i + 1}</span>
                    <div>
                      <p className="text-sm">{p.action}</p>
                      <p className="text-xs text-muted">{p.why}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {report.confirm.length > 0 && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
              <p className="text-sm font-medium text-amber-200">Confirm before acting</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-100/80">
                {report.confirm.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-faint">
            {report.limits || "This plan is based on comments. It suggests what to try; only real results show what works."}
          </p>
        </section>
      )}
      <section className="panel p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <History size={14} /> Past plans
        </h2>
        {saveNote && <p className="mb-2 text-xs text-amber-200">{saveNote}</p>}
        {runs.length === 0 ? (
          <p className="text-xs text-faint">Every plan the agent writes is saved here.</p>
        ) : (
          <ul className="divide-y divide-navy-700">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-2">
                <button onClick={() => openPast(r.id)} className="min-w-0 flex-1 text-left hover:text-brand-blue">
                  <p className="truncate text-sm">{r.goal}</p>
                  <p className="text-[11px] text-faint">
                    {new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </button>
                <button onClick={() => removePast(r.id)} title="Delete plan" className="rounded p-1.5 text-faint hover:bg-navy-800 hover:text-red-300">
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
