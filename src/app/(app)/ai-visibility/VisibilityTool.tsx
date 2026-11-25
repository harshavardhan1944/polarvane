"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Radar, Sparkles, Trash2, XCircle } from "lucide-react";
import type { DashboardItem } from "@/lib/dashboards";
import type { SuggestedQuestion } from "@/lib/visibility";
import { deleteRun, runCheck, suggestFromComments, type CheckRow } from "./actions";

const MAX_QUESTIONS = 10;

// "L'Oréal Professionnel" and "L'Oreal Professionnel" -> same key.
function brandKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const inputCls =
  "w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/25";

const SENTIMENT: Record<string, { label: string; cls: string }> = {
  positive: { label: "Positive", cls: "text-emerald-300" },
  neutral: { label: "Neutral", cls: "text-muted" },
  negative: { label: "Negative", cls: "text-red-300" },
  not_mentioned: { label: "Not mentioned", cls: "text-faint" },
};

function ResultRow({ row }: { row: CheckRow }) {
  const [open, setOpen] = useState(false);
  const s = SENTIMENT[row.sentiment ?? "not_mentioned"] ?? SENTIMENT.not_mentioned;
  return (
    <div className="border-t border-navy-700 first:border-t-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-navy-850"
      >
        {row.mentioned ? (
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-300" aria-label="Mentioned" />
        ) : (
          <XCircle size={18} className="mt-0.5 shrink-0 text-red-300" aria-label="Not mentioned" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{row.question}</p>
          <p className="mt-1 text-xs text-muted">
            {row.mentioned ? (
              <>
                Mentioned{row.rank ? ` · position #${row.rank}` : ""} · <span className={s.cls}>{s.label}</span>
              </>
            ) : (
              "Not mentioned"
            )}
            {row.competitors.length > 0 && <> · Recommended instead: {row.competitors.slice(0, 4).join(", ")}</>}
          </p>
        </div>
        <ChevronDown size={16} className={`mt-1 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4 pl-11 text-sm">
          {row.description && row.mentioned && <p className="text-muted">How it describes the brand: {row.description}</p>}
          <div className="rounded-lg border border-navy-700 bg-navy-900 p-3 text-xs leading-relaxed whitespace-pre-wrap text-ink/90">
            {row.answer}
          </div>
          <p className="text-xs text-faint">
            Answered by {row.model} {row.web_search ? "with Google Search" : "without web search"}.
          </p>
          {row.sources.length > 0 && (
            <div className="text-xs text-muted">
              Sources the AI used:{" "}
              {row.sources.map((src, i) => (
                <span key={src.title}>
                  {i > 0 && ", "}
                  {src.uri ? (
                    <a href={src.uri} target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">
                      {src.title}
                    </a>
                  ) : (
                    src.title
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Score({ rows, brand }: { rows: CheckRow[]; brand: string }) {
  const hits = rows.filter((r) => r.mentioned).length;
  // Count each brand once per answer, treating "L'Oréal" and "L'Oreal" as the same name.
  const competitors = new Map<string, { name: string; n: number }>();
  rows.forEach((r) => {
    const seen = new Set<string>();
    r.competitors.forEach((c) => {
      const key = brandKey(c);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const cur = competitors.get(key);
      const name = cur && /[^\x00-\x7f]/.test(cur.name) ? cur.name : c; // prefer the accented spelling
      competitors.set(key, { name, n: (cur?.n ?? 0) + 1 });
    });
  });
  const top = [...competitors.values()].sort((a, b) => b.n - a.n).slice(0, 5).map((c) => [c.name, c.n] as const);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="stat-card p-4">
        <p className="text-xs text-muted">{brand} appeared in</p>
        <p className="mt-1 text-2xl font-semibold">
          {hits} of {rows.length} answers
        </p>
        <p className="text-xs text-faint">{rows.length ? Math.round((hits / rows.length) * 100) : 0}% of questions checked</p>
      </div>
      <div className="stat-card p-4">
        <p className="text-xs text-muted">Most recommended instead</p>
        {top.length ? (
          <p className="mt-1 text-sm">{top.map(([name, n]) => `${name} (${n})`).join(" · ")}</p>
        ) : (
          <p className="mt-1 text-sm text-faint">No other brands named</p>
        )}
      </div>
    </div>
  );
}

export function VisibilityTool({
  dashboards,
  history,
  setupNeeded,
}: {
  dashboards: DashboardItem[];
  history: CheckRow[];
  setupNeeded: boolean;
}) {
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState("");
  const [dashboardId, setDashboardId] = useState("");
  const [questionsText, setQuestionsText] = useState("");
  const [suggested, setSuggested] = useState<SuggestedQuestion[]>([]);
  const [suggesting, startSuggest] = useTransition();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<CheckRow[]>([]);
  const [runBrand, setRunBrand] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(setupNeeded ? "Results can’t be saved yet. Run the AI visibility setup script (008_ai_visibility.sql) in Supabase." : "");
  const [past, setPast] = useState(history);

  const questions = questionsText
    .split("\n")
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, MAX_QUESTIONS);

  const runs = useMemo(() => {
    const map = new Map<string, CheckRow[]>();
    past.forEach((r) => map.set(r.run_id, [...(map.get(r.run_id) ?? []), r]));
    return [...map.entries()].map(([id, rows]) => ({ id, rows, brand: rows[0].brand, at: rows[0].created_at }));
  }, [past]);

  function suggest() {
    setError("");
    if (!brand.trim()) return setError("Enter the brand name first.");
    startSuggest(async () => {
      const res = await suggestFromComments(dashboardId, brand, product);
      if (!res.ok) return setError(res.message);
      setSuggested(res.questions);
      setQuestionsText(res.questions.map((q) => q.question).join("\n"));
    });
  }

  async function run() {
    setError("");
    if (!brand.trim()) return setError("Enter the brand name first.");
    if (questions.length === 0) return setError("Add at least one question, or suggest them from comments.");
    const runId = crypto.randomUUID();
    setRunning(true);
    setRunBrand(brand.trim());
    setResults([]);
    setProgress({ done: 0, total: questions.length });
    const done: CheckRow[] = [];
    for (const q of questions) {
      const res = await runCheck(runId, brand, q);
      if (!res.ok) {
        setError(res.message);
        break;
      }
      if (res.warning) setWarning(res.warning);
      done.push(res.row);
      setResults([...done]);
      setProgress({ done: done.length, total: questions.length });
    }
    if (done.length) setPast((p) => [...[...done].reverse(), ...p]);
    setRunning(false);
  }

  async function removeRun(id: string) {
    setPast((p) => p.filter((r) => r.run_id !== id));
    await deleteRun(id);
  }

  return (
    <div className="space-y-6">
      <div className="panel space-y-4 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted">
            Brand name
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Minimalist" className={`mt-1 ${inputCls}`} />
          </label>
          <label className="text-xs text-muted">
            Product or category (optional)
            <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. sunscreen" className={`mt-1 ${inputCls}`} />
          </label>
          <label className="text-xs text-muted">
            Use comments from
            <select value={dashboardId} onChange={(e) => setDashboardId(e.target.value)} className={`mt-1 ${inputCls}`}>
              <option value="">All analyzed posts</option>
              {dashboards.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-xs text-muted">Questions to ask the AI (one per line, up to {MAX_QUESTIONS})</p>
            <button
              onClick={suggest}
              disabled={suggesting || running}
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 px-3 py-1.5 text-xs text-ink hover:bg-navy-800 disabled:opacity-50"
            >
              {suggesting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-brand-violet" />}
              Suggest from customer comments
            </button>
          </div>
          <textarea
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            rows={5}
            placeholder={"Best sunscreen for oily skin in India\nSunscreen with no white cast for daily use"}
            className={inputCls}
          />
          {suggested.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-faint">
              {suggested.map((q) => (
                <li key={q.question}>
                  “{q.question}” comes from customers asking about {q.basedOn}
                  {q.mentions > 1 ? ` (about ${q.mentions} comments)` : ""}.
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={run}
            disabled={running || suggesting}
            className="brand-gradient inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-brand-violet/20 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />}
            {running ? `Checking ${progress.done + 1} of ${progress.total}…` : `Check ${questions.length || ""} question${questions.length === 1 ? "" : "s"}`}
          </button>
          <p className="text-xs text-faint">
            Uses Google Gemini with Google Search. Each question uses two AI requests from your Gemini quota.
          </p>
        </div>

        {error && (
          <p className="flex items-start gap-1.5 text-xs text-red-300">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        {warning && (
          <p className="flex items-start gap-1.5 text-xs text-amber-300">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {warning}
          </p>
        )}
      </div>

      {results.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">This check</h2>
          <Score rows={results} brand={runBrand} />
          <div className="panel">{results.map((r) => <ResultRow key={r.id} row={r} />)}</div>
        </section>
      )}

      {runs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Past checks</h2>
          {runs.map((r) => {
            const hits = r.rows.filter((x) => x.mentioned).length;
            return (
              <details key={r.id} className="panel group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium">{r.brand}</p>
                    <p className="text-xs text-muted">
                      Appeared in {hits} of {r.rows.length} answers ·{" "}
                      {new Date(r.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (confirm("Delete this check?")) removeRun(r.id);
                      }}
                      aria-label="Delete this check"
                      className="rounded-md p-1.5 text-faint hover:bg-navy-800 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronDown size={16} className="text-faint transition-transform group-open:rotate-180" />
                  </div>
                </summary>
                <div className="border-t border-navy-700">
                  {r.rows.map((row) => (
                    <ResultRow key={row.id} row={row} />
                  ))}
                </div>
              </details>
            );
          })}
        </section>
      )}

      <p className="text-xs leading-relaxed text-faint">
        AI answers change from one request to the next and differ between assistants and apps, so treat a single check as an
        indication, not a fixed ranking. Re-run the same questions over time to see the trend.
      </p>
    </div>
  );
}
