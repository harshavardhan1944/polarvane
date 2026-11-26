"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Download,
  ExternalLink,
  History,
  Loader2,
  Quote,
  Rocket,
  Square,
  Trash2,
  XCircle,
} from "lucide-react";
import type { AiCheck, LaunchInput, LaunchReport, LaunchResearchPlan, ThreadHit } from "@/lib/launch";
import {
  deleteLaunch,
  launchAskAI,
  launchCheckCollect,
  launchCheckSearch,
  launchChoose,
  launchCollect,
  launchPlan,
  launchSearch,
  launchWrite,
  openLaunch,
  saveLaunch,
  type SavedLaunch,
} from "./actions";

type Step = { label: string; detail: string; status: "running" | "done" | "failed" };
type Research = { plan: LaunchResearchPlan | null; threads: ThreadHit[]; checks: AiCheck[] };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const IG_PRICE = 2.5; // $ per 1,000 Instagram comments (estimate)
const REDDIT_PRICE = 3.4; // $ per 1,000 Reddit comments (estimate)

function Ev({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((t) => (
        <li key={t} className="flex gap-1.5 text-xs text-faint">
          <Quote size={11} className="mt-0.5 shrink-0" />
          <span className="italic">{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Blanks({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/g).map((p, i) =>
        /^\[.*\]$/.test(p) ? (
          <span key={i} className="rounded bg-amber-400/15 px-1 text-amber-200">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function reportText(input: LaunchInput, r: LaunchReport, research: Research) {
  const L: string[] = [
    `LAUNCH PLAN (Polarvane)`,
    `Product: ${input.product}${input.brand ? ` · Brand: ${input.brand}` : ""} · Market: ${input.market}`,
    "",
    r.headline,
    "",
    r.summary,
    "",
  ];
  const list = (title: string, items: { text: string; mentions?: number; evidence: string[] }[]) => {
    if (!items.length) return;
    L.push(title.toUpperCase());
    items.forEach((x) => {
      L.push(`- ${x.text}${x.mentions ? ` (about ${x.mentions} comments)` : ""}`);
      x.evidence.forEach((e) => L.push(`  "${e}"`));
    });
    L.push("");
  };
  list("What shoppers want", r.needs);
  list("What worries them", r.worries);
  if (r.price.summary) L.push("PRICE", r.price.summary, ...r.price.evidence.map((e) => `  "${e}"`), "");
  if (r.competitors.length) {
    L.push("COMPETITORS");
    r.competitors.forEach((c) => L.push(`- ${c.name}: loved for ${c.lovedFor || "—"}; criticized for ${c.criticizedFor || "—"}`));
    L.push("");
  }
  if (r.aiDiscovery) L.push("AI DISCOVERY", r.aiDiscovery, "");
  if (r.positioning.statement) L.push("POSITIONING", r.positioning.statement, `Why: ${r.positioning.why}`, "");
  list("Launch hooks", r.hooks);
  if (r.scripts.length) {
    L.push("LAUNCH SCRIPTS");
    r.scripts.forEach((sc, i) => {
      L.push(`Script ${i + 1}: ${sc.title} (${[sc.format, sc.length].filter(Boolean).join(", ")})`);
      sc.scenes.forEach((x) => L.push(`  ${x.time || "-"}  SHOW: ${x.show}`, `          SAY: "${x.say}"`));
      if (sc.cta) L.push(`  ENDS WITH: ${sc.cta}`);
    });
    L.push("");
  }
  if (r.checklist.length) {
    L.push("LAUNCH CHECKLIST");
    r.checklist.forEach((c, i) => L.push(`${i + 1}. ${c.step}`, `   Why: ${c.why}`));
    L.push("");
  }
  if (r.confirm.length) L.push("CONFIRM BEFORE USING", ...r.confirm.map((c) => `- ${c}`), "");
  if (research.threads.length) L.push("REDDIT THREADS READ", ...research.threads.map((t) => `- ${t.title} (${t.url})`), "");
  L.push(`Based on ${r.commentsUsed} public comments and ${research.checks.filter((c) => !c.error).length} AI assistant answers.`);
  if (r.limits) L.push(`Note: ${r.limits}`);
  return L.join("\n");
}

export function LaunchPlanner({ initial }: { initial: SavedLaunch[] }) {
  const [input, setInput] = useState<LaunchInput>({ product: "", brand: "", market: "India", competitors: "", notes: "" });
  const [igLinks, setIgLinks] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [research, setResearch] = useState<Research>({ plan: null, threads: [], checks: [] });
  const [report, setReport] = useState<LaunchReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<SavedLaunch[]>(initial);
  const stop = useRef(false);

  const igUrls = igLinks
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => /instagram\.com\//i.test(x))
    .slice(0, 3);
  const maxCost = 0.12 + (4 * 150 * REDDIT_PRICE) / 1000 + (igUrls.length * 150 * IG_PRICE) / 1000;

  function push(label: string, detail = "") {
    setSteps((s) => [...s, { label, detail, status: "running" }]);
  }
  function finish(detail: string, status: Step["status"] = "done") {
    setSteps((s) => s.map((x, i) => (i === s.length - 1 ? { ...x, detail, status } : x)));
  }
  const set = (k: keyof LaunchInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setInput((v) => ({ ...v, [k]: e.target.value }));

  async function run() {
    setError("");
    setNote("");
    setReport(null);
    setSteps([]);
    if (input.product.trim().length < 3) return setError("Describe the product in a few words.");
    stop.current = false;
    setBusy(true);
    const r: Research = { plan: null, threads: [], checks: [] };
    const comments: { text: string; source: "reddit" | "instagram" }[] = [];
    try {
      // 1. Plan
      push("Planning the research");
      const p = await launchPlan(input);
      if (!p.ok) throw new Error(p.message);
      r.plan = p.plan;
      finish(`Will search Reddit for “${p.plan.redditSearches.join("”, “")}” and ask AI ${p.plan.aiQuestions.length} shopper questions.`);

      // 2. Search Reddit
      const hits: ThreadHit[] = [];
      for (const q of p.plan.redditSearches) {
        if (stop.current) break;
        push(`Searching Reddit: “${q}”`);
        const st = await launchSearch(q);
        if (!st.ok) {
          finish(st.message, "failed");
          continue;
        }
        let found: ThreadHit[] | null = null;
        for (let i = 0; i < 45 && !stop.current; i++) {
          await wait(4000);
          const c = await launchCheckSearch(st.ticket);
          if (!c.ok) break;
          if (c.done) {
            found = c.hits;
            break;
          }
        }
        if (found) {
          hits.push(...found);
          finish(`${found.length} threads found.`);
        } else finish("No results (or it took too long).", "failed");
      }

      // 3. Choose threads
      if (hits.length && !stop.current) {
        push("Choosing the most useful threads");
        const ch = await launchChoose(input, hits);
        if (ch.ok) {
          r.threads = ch.threads;
          finish(ch.threads.map((t) => t.title).join(" · ") || "None were relevant.");
        } else finish(ch.message, "failed");
      }

      // 4. Collect comments
      if ((r.threads.length || igUrls.length) && !stop.current) {
        push("Collecting comments", "Reddit threads and competitor posts. This can take 1–4 minutes.");
        const col = await launchCollect(
          r.threads.map((t) => t.url),
          igUrls,
        );
        if (!col.ok) finish(col.message, "failed");
        else {
          if (col.warnings.length) setNote(col.warnings.join(" "));
          const pending = new Map(col.jobs.map((j) => [j.ticket, j]));
          for (let i = 0; i < 80 && pending.size && !stop.current; i++) {
            await wait(5000);
            for (const [ticket, job] of [...pending]) {
              const c = await launchCheckCollect(ticket, job.source);
              if (!c.ok) {
                pending.delete(ticket);
                continue;
              }
              if (c.done) {
                comments.push(...c.texts.map((text) => ({ text, source: job.source })));
                pending.delete(ticket);
              }
            }
          }
          const reddit = comments.filter((c) => c.source === "reddit").length;
          const ig = comments.length - reddit;
          finish(`${reddit} Reddit comments${igUrls.length ? ` and ${ig} Instagram comments` : ""} collected.`, comments.length ? "done" : "failed");
        }
      }

      // 5. Ask AI assistants
      for (const q of p.plan.aiQuestions) {
        if (stop.current) break;
        push(`Asking an AI assistant: “${q}”`);
        const a = await launchAskAI(input.brand, q);
        if (!a.ok) {
          finish(a.message, "failed");
          if (/busy|limit/i.test(a.message)) break;
          continue;
        }
        r.checks.push(a.check);
        finish(
          a.check.error
            ? a.check.error
            : a.check.recommended.length
              ? `Recommends: ${a.check.recommended.slice(0, 5).join(", ")}${input.brand ? ` · ${input.brand} ${a.check.brandMentioned ? "is" : "is NOT"} mentioned` : ""}`
              : "No brands named.",
          a.check.error ? "failed" : "done",
        );
      }
      setResearch({ ...r });

      // 6. Write the plan
      push("Writing the launch plan");
      const w = await launchWrite(input, comments, r.checks);
      if (!w.ok) {
        finish(w.message, "failed");
        throw new Error(w.message);
      }
      finish(`Based on ${w.report.commentsUsed} comments.`);
      setReport(w.report);

      const sv = await saveLaunch(input, r, w.report).catch(() => null);
      if (sv?.ok) setSaved((list) => [{ id: sv.id, product: input.product, market: input.market, created_at: new Date().toISOString() }, ...list]);
      else if (sv) setNote((n) => `${n} ${sv.message}`.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openPast(id: string) {
    if (busy) return;
    const o = await openLaunch(id);
    if (!o.ok) return setError(o.message);
    setInput(o.input);
    setResearch(o.research);
    setReport(o.report);
    setSteps([]);
    setError("");
  }

  async function removePast(id: string) {
    const d = await deleteLaunch(id);
    if (d.ok) setSaved((l) => l.filter((x) => x.id !== id));
  }

  function download() {
    if (!report) return;
    const blob = new Blob([reportText(input, report, research)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polarvane-launch-plan.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = "w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm outline-none focus:border-brand-blue/60";

  return (
    <div className="space-y-6">
      <section className="panel space-y-4 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Product to launch *</label>
            <input value={input.product} onChange={set("product")} disabled={busy} maxLength={120} placeholder="e.g. Korean SPF 50 gel sunscreen for oily skin" className={field} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Brand name</label>
            <input value={input.brand} onChange={set("brand")} disabled={busy} maxLength={80} placeholder="e.g. Lumora" className={field} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Market</label>
            <input value={input.market} onChange={set("market")} disabled={busy} maxLength={60} placeholder="India" className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Main competitors (optional)</label>
            <input value={input.competitors} onChange={set("competitors")} disabled={busy} maxLength={200} placeholder="e.g. Minimalist, Dot & Key, La Roche-Posay" className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Competitor Instagram post links (optional, up to 3)</label>
            <textarea
              value={igLinks}
              onChange={(e) => setIgLinks(e.target.value)}
              disabled={busy}
              rows={2}
              placeholder="Paste links to competitors' product posts or Reels, one per line"
              className={field}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Notes (optional): price, audience, what&apos;s new</label>
            <input value={input.notes} onChange={set("notes")} disabled={busy} maxLength={500} placeholder="e.g. ₹699, for 18–30 with oily skin, no white cast" className={field} />
          </div>
        </div>
        <p className="text-[11px] text-faint">
          The agent searches Reddit, reads up to 4 threads ({igUrls.length ? `and ${igUrls.length} Instagram post${igUrls.length > 1 ? "s" : ""}` : "no Instagram posts"}), and asks AI assistants 3 shopper questions.
          Max Apify cost about ${maxCost.toFixed(2)}; it uses about 8–10 Gemini calls. Takes 3–8 minutes. Usernames are never stored.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={run}
            disabled={busy}
            className="brand-gradient inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
            {busy ? "Researching the launch…" : "Plan the launch"}
          </button>
          {busy && (
            <button onClick={() => (stop.current = true)} className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 px-3 py-2 text-xs hover:bg-navy-800">
              <Square size={12} /> Stop and write with what’s found
            </button>
          )}
        </div>
        {error && (
          <p className="flex items-start gap-1.5 text-xs text-red-300">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        {note && <p className="text-xs text-amber-200">{note}</p>}
      </section>

      {steps.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">What the agent did</h2>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="panel flex gap-3 p-3">
                {s.status === "running" ? (
                  <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-brand-blue" />
                ) : s.status === "failed" ? (
                  <XCircle size={16} className="mt-0.5 shrink-0 text-red-300" />
                ) : (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                )}
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="text-faint">{i + 1}.</span> {s.label}
                  </p>
                  {s.detail && <p className="mt-0.5 text-xs text-muted">{s.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {report && (
        <section className="panel space-y-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-faint">
                Launch plan · {input.product}
                {input.brand ? ` · ${input.brand}` : ""} · {input.market}
              </p>
              <h2 className="mt-1 font-display text-xl">{report.headline}</h2>
            </div>
            <button onClick={download} className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 px-3 py-2 text-sm hover:bg-navy-800">
              <Download size={14} /> Download
            </button>
          </div>
          {report.summary && <p className="text-sm text-muted">{report.summary}</p>}

          {report.positioning.statement && (
            <div className="rounded-lg border border-brand-blue/40 bg-brand-blue/10 p-4">
              <p className="text-xs text-faint">Suggested positioning</p>
              <p className="mt-1 text-base">
                <Blanks text={report.positioning.statement} />
              </p>
              {report.positioning.why && <p className="mt-1 text-xs text-muted">{report.positioning.why}</p>}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {[
              { t: "What shoppers want", items: report.needs },
              { t: "What worries them", items: report.worries },
            ].map((blk) =>
              blk.items.length ? (
                <div key={blk.t}>
                  <h3 className="mb-2 text-sm font-medium">{blk.t}</h3>
                  <ul className="space-y-2">
                    {blk.items.map((x) => (
                      <li key={x.text} className="rounded-lg border border-navy-700 bg-navy-900 p-3">
                        <p className="text-sm">
                          {x.text} <span className="text-xs text-faint">· about {x.mentions} comment{x.mentions === 1 ? "" : "s"}</span>
                        </p>
                        <Ev items={x.evidence} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>

          {report.price.summary && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Price and value</h3>
              <div className="rounded-lg border border-navy-700 bg-navy-900 p-3">
                <p className="text-sm">{report.price.summary}</p>
                <Ev items={report.price.evidence} />
              </div>
            </div>
          )}

          {report.competitors.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Competitors, as shoppers see them</h3>
              <div className="overflow-x-auto rounded-lg border border-navy-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-navy-850 text-faint">
                    <tr>
                      <th className="p-2.5 font-medium">Brand</th>
                      <th className="p-2.5 font-medium">Loved for</th>
                      <th className="p-2.5 font-medium">Criticized for</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700">
                    {report.competitors.map((c) => (
                      <tr key={c.name}>
                        <td className="p-2.5 text-sm">{c.name}</td>
                        <td className="p-2.5 text-emerald-200/90">{c.lovedFor || "—"}</td>
                        <td className="p-2.5 text-red-200/90">{c.criticizedFor || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.aiDiscovery && (
            <div>
              <h3 className="mb-2 text-sm font-medium">AI discovery</h3>
              <p className="text-sm text-muted">{report.aiDiscovery}</p>
              {research.checks.filter((c) => !c.error).length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {research.checks
                    .filter((c) => !c.error)
                    .map((c) => (
                      <li key={c.question} className="rounded-lg border border-navy-700 bg-navy-900 p-2.5 text-xs">
                        <p className="text-ink">“{c.question}”</p>
                        <p className="mt-0.5 text-muted">
                          Recommends: {c.recommended.join(", ") || "no brands"}
                          {input.brand ? ` · ${input.brand}: ${c.brandMentioned ? "mentioned" : "not mentioned"}` : ""}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}

          {report.hooks.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Launch ad hooks</h3>
              <ul className="space-y-2">
                {report.hooks.map((h) => (
                  <li key={h.text} className="rounded-lg border border-navy-700 bg-navy-900 p-3">
                    <p className="text-sm">
                      <Blanks text={h.text} />
                    </p>
                    <Ev items={h.evidence} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.scripts.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Clapperboard size={14} /> Launch video scripts
              </h3>
              <ul className="space-y-3">
                {report.scripts.map((sc, n) => (
                  <li key={sc.title} className="rounded-lg border border-navy-700 bg-navy-900 p-4">
                    <p className="text-sm font-medium">
                      Script {n + 1}: {sc.title} <span className="text-xs font-normal text-faint">· {[sc.format, sc.length].filter(Boolean).join(" · ")}</span>
                    </p>
                    <ol className="mt-2 space-y-1.5">
                      {sc.scenes.map((x, i) => (
                        <li key={i} className="grid gap-1 rounded-md border border-navy-700/70 p-2.5 text-xs sm:grid-cols-[64px_1fr_1fr] sm:gap-3">
                          <span className="font-mono text-faint">{x.time || `Scene ${i + 1}`}</span>
                          <span className="text-muted">
                            <span className="text-faint">Show: </span>
                            <Blanks text={x.show} />
                          </span>
                          <span className="text-ink">
                            <span className="text-faint">Say: </span>“<Blanks text={x.say} />”
                          </span>
                        </li>
                      ))}
                    </ol>
                    {sc.cta && (
                      <p className="mt-2 text-xs">
                        <span className="text-faint">Ends with: </span>
                        <Blanks text={sc.cta} />
                      </p>
                    )}
                    {sc.why && <p className="mt-1 text-xs text-muted">Why: {sc.why}</p>}
                    <Ev items={sc.evidence} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.checklist.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Launch checklist</h3>
              <ol className="space-y-2">
                {report.checklist.map((c, i) => (
                  <li key={c.step} className="flex gap-3 rounded-lg border border-navy-700 bg-navy-900 p-3">
                    <span className="font-display text-lg text-brand-blue">{i + 1}</span>
                    <div>
                      <p className="text-sm">{c.step}</p>
                      <p className="text-xs text-muted">{c.why}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {report.confirm.length > 0 && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
              <p className="text-sm font-medium text-amber-200">Confirm before using</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-100/80">
                {report.confirm.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {research.threads.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium">Reddit threads read</h3>
              <ul className="space-y-1">
                {research.threads.map((t) => (
                  <li key={t.url} className="text-xs">
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-blue hover:underline">
                      {t.title} <ExternalLink size={10} />
                    </a>
                    {t.community && <span className="text-faint"> · {t.community}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-faint">
            Based on {report.commentsUsed} public comments and {research.checks.filter((c) => !c.error).length} AI assistant answers.{" "}
            {report.limits || "It shows what shoppers say; it doesn't measure market size or predict sales."}
          </p>
        </section>
      )}

      <section className="panel p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <History size={14} /> Past launch plans
        </h2>
        {saved.length === 0 ? (
          <p className="text-xs text-faint">Every launch plan is saved here.</p>
        ) : (
          <ul className="divide-y divide-navy-700">
            {saved.map((x) => (
              <li key={x.id} className="flex items-center gap-2 py-2">
                <button onClick={() => openPast(x.id)} className="min-w-0 flex-1 text-left hover:text-brand-blue">
                  <p className="truncate text-sm">
                    {x.product} · {x.market}
                  </p>
                  <p className="text-[11px] text-faint">{new Date(x.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                </button>
                <button onClick={() => removePast(x.id)} title="Delete plan" className="rounded p-1.5 text-faint hover:bg-navy-800 hover:text-red-300">
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
