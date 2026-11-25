"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Download, Loader2, Megaphone, Quote, ShieldCheck } from "lucide-react";
import type { AdBrief, BriefItem, PostSignals } from "@/lib/adbrief";
import type { CopyCheck, CopyStatus } from "@/lib/copycheck";
import { checkCopy, makeBrief } from "./actions";
import { VideoChecker } from "./VideoChecker";

export type PostCard = PostSignals & { label: string; views: number | null; likes: number | null };

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const comments = (n: number) => `about ${n} comment${n === 1 ? "" : "s"}`;
const num = (v: number | null) => (v === null ? "—" : new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v));

function Badge({ post, isTop, minComments }: { post: PostCard; isTop: boolean; minComments: number }) {
  if (post.score === null)
    return (
      <span className="rounded-full border border-navy-600 px-2 py-0.5 text-[11px] text-faint">
        Too few comments (needs {minComments})
      </span>
    );
  if (isTop)
    return (
      <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300">
        Recommended for paid ad testing
      </span>
    );
  return <span className="rounded-full border border-navy-600 px-2 py-0.5 text-[11px] text-muted">Possible test</span>;
}

function Evidence({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {items.map((t) => (
        <li key={t} className="flex gap-1.5 text-xs text-faint">
          <Quote size={11} className="mt-0.5 shrink-0" />
          <span className="italic">{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, items, extra }: { title: string; items: BriefItem[]; extra?: (i: number) => string }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={it.text} className="rounded-lg border border-navy-700 bg-navy-900 p-3">
            <p className="text-sm">
              {it.text}
              {extra && <span className="text-xs text-faint"> · {extra(i)}</span>}
            </p>
            {it.detail && <p className="mt-1 text-xs text-muted">{it.detail}</p>}
            <Evidence items={it.evidence} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function briefToText(brief: AdBrief, posts: string[]) {
  const lines: string[] = [`AD BRIEF (Polarvane)`, `Based on ${brief.commentsUsed} comments from: ${posts.join(", ")}`, ""];
  if (brief.summary) lines.push(brief.summary, "");
  const block = (title: string, items: BriefItem[], extra?: (i: number) => string) => {
    if (!items.length) return;
    lines.push(title.toUpperCase());
    items.forEach((it, i) => {
      lines.push(`- ${it.text}${extra ? ` (${extra(i)})` : ""}`);
      if (it.detail) lines.push(`  ${it.detail}`);
      it.evidence.forEach((e) => lines.push(`  Comment: "${e}"`));
    });
    lines.push("");
  };
  block("Hook ideas", brief.hooks);
  block("Doubts to answer", brief.doubts, (i) => comments(brief.doubts[i].mentions));
  block("What to show", brief.show);
  block("What to avoid", brief.avoid);
  if (brief.verify.length) {
    lines.push("CONFIRM BEFORE USING IN ADS");
    brief.verify.forEach((v) => lines.push(`- ${v}`));
    lines.push("");
  }
  lines.push("Comment signals suggest what to test; only the ad results show what works.");
  return lines.join("\n");
}

const STATUS: Record<CopyStatus, { label: string; cls: string }> = {
  doubted: { label: "Customers doubt this", cls: "border-red-400/40 bg-red-400/10 text-red-300" },
  needs_proof: { label: "Needs proof", cls: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  supported: { label: "Customers agree", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
  ok: { label: "Fine", cls: "border-navy-600 text-muted" },
};
const ORDER: CopyStatus[] = ["doubted", "needs_proof", "supported", "ok"];

function CopyChecker({ selected }: { selected: string[] }) {
  const [copy, setCopy] = useState("");
  const [result, setResult] = useState<CopyCheck | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function run() {
    setError("");
    if (copy.trim().length < 5) return setError("Paste the ad text you want to check.");
    if (selected.length === 0) return setError("Tick at least one post above to check against.");
    start(async () => {
      const res = await checkCopy(selected, copy);
      if (!res.ok) {
        setResult(null);
        return setError(res.message);
      }
      setResult(res.check);
    });
  }

  const flags = result ? [...result.flags].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)) : [];
  const counts = result
    ? ORDER.map((s) => [s, result.flags.filter((f) => f.status === s).length] as const).filter(([, n]) => n > 0)
    : [];

  return (
    <section className="panel space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl">
          <ShieldCheck size={18} /> Ad copy checker
        </h2>
        <p className="mt-1 text-xs text-faint">
          Paste a draft ad. Each line is checked against real comments on the ticked posts ({selected.length}).
        </p>
      </div>
      <textarea
        value={copy}
        onChange={(e) => setCopy(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="e.g. Lightweight SPF 50 for every skin type. No white cast, no breakouts. Shop now."
        className="w-full rounded-lg border border-navy-600 bg-navy-900 p-3 text-sm outline-none focus:border-brand-blue/60"
      />
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg border border-navy-600 px-4 py-2 text-sm hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
        {pending ? "Checking…" : "Check this ad"}
      </button>
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-300">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-navy-700 bg-navy-900 p-3">
            <p className="text-sm">{result.verdict}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {counts.map(([s, n]) => (
                <span key={s} className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS[s].cls}`}>
                  {n} · {STATUS[s].label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-faint">Checked against {result.commentsUsed} comments.</p>
          </div>
          <ul className="space-y-3">
            {flags.map((f, i) => (
              <li key={`${f.line}-${i}`} className="rounded-lg border border-navy-700 bg-navy-900 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">“{f.line}”</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS[f.status].cls}`}>
                    {STATUS[f.status].label}
                  </span>
                  {f.mentions > 0 && <span className="text-xs text-faint">{comments(f.mentions)}</span>}
                </div>
                {f.why && <p className="mt-1 text-xs text-muted">{f.why}</p>}
                {f.suggestion && f.status !== "ok" && (
                  <p className="mt-1 text-xs text-ink">
                    <b>Suggestion:</b> {f.suggestion}
                  </p>
                )}
                <Evidence items={f.evidence} />
              </li>
            ))}
          </ul>
          {result.missing.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Doubts this ad doesn’t answer</h3>
              <ul className="space-y-3">
                {result.missing.map((m) => (
                  <li key={m.text} className="rounded-lg border border-navy-700 bg-navy-900 p-3">
                    <p className="text-sm">
                      {m.text} <span className="text-xs text-faint">· {comments(m.mentions)}</span>
                    </p>
                    <Evidence items={m.evidence} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-faint">
            Polarvane checks what customers say, not whether a claim is true. Confirm every product claim before running the ad.
          </p>
        </div>
      )}
    </section>
  );
}

export function AdRecommendations({ posts, minComments }: { posts: PostCard[]; minComments: number }) {
  const scored = posts.filter((p) => p.score !== null);
  const topId = scored[0]?.id;
  const [selected, setSelected] = useState<string[]>(() =>
    (scored.length ? scored.slice(0, 3) : posts.slice(0, 3)).map((p) => p.id),
  );
  const [brief, setBrief] = useState<AdBrief | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const anyNoFocus = posts.some((p) => p.total > 0 && !p.hasFocus);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function generate() {
    setError("");
    if (selected.length === 0) return setError("Choose at least one post.");
    start(async () => {
      const res = await makeBrief(selected);
      if (!res.ok) {
        setBrief(null);
        return setError(res.message);
      }
      setBrief(res.brief);
    });
  }

  function download() {
    if (!brief) return;
    const names = posts.filter((p) => selected.includes(p.id)).map((p) => p.label);
    const blob = new Blob([briefToText(brief, names)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polarvane-ad-brief.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Posts ranked by product interest</h2>
        <div className="panel divide-y divide-navy-700">
          {posts.map((p) => (
            <label key={p.id} className="flex cursor-pointer gap-3 p-4 hover:bg-navy-850">
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => toggle(p.id)}
                className="mt-1 h-4 w-4 accent-[#5b8cff]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{p.label}</p>
                  <Badge post={p} isTop={p.id === topId} minComments={minComments} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-6">
                  <span>Score: <b className="text-ink">{p.score ?? "—"}</b></span>
                  <span>Comments: {p.total}</span>
                  <span>About product: {pct(p.productShare)}</span>
                  <span>Only creator: {pct(p.creatorShare)}</span>
                  <span>Questions: {pct(p.questionShare)}</span>
                  <span>Views: {num(p.views)}</span>
                </div>
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-faint">
          Score (0–100) = share of comments about the product (50%), share of questions (30%), share of positive comments
          (20%). It suggests which posts to test as paid ads. It does not predict sales; only the ad results show what works.
          {anyNoFocus && " Some posts were analyzed before product focus existed; use “Re-analyze with AI” on the Analyze page to include it."}
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={generate}
          disabled={pending}
          className="brand-gradient inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-brand-violet/20 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Megaphone size={15} />}
          {pending ? "Writing the brief…" : `Write ad brief from ${selected.length} post${selected.length === 1 ? "" : "s"}`}
        </button>
        {brief && (
          <button
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 px-3 py-2 text-sm hover:bg-navy-800"
          >
            <Download size={14} /> Download brief
          </button>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-300">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {brief && (
        <section className="panel space-y-6 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-xl">Ad brief</h2>
            <p className="mt-1 text-xs text-faint">Written from {brief.commentsUsed} real comments. Every point shows the comments behind it.</p>
            {brief.commentsUsed < 60 && (
              <p className="mt-2 text-xs text-amber-200/90">
                Based on only {brief.commentsUsed} comments. Select 2–3 posts together for a stronger brief.
              </p>
            )}
            {brief.summary && <p className="mt-3 text-sm text-muted">{brief.summary}</p>}
          </div>
          <Section title="Hook ideas" items={brief.hooks} />
          <Section title="Doubts to answer in the ad" items={brief.doubts} extra={(i) => comments(brief.doubts[i].mentions)} />
          <Section title="What to show" items={brief.show} />
          <Section title="What to avoid" items={brief.avoid} />
          {brief.verify.length > 0 && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
              <p className="text-sm font-medium text-amber-200">Confirm before using in ads</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-100/80">
                {brief.verify.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      <VideoChecker selected={selected} />
      <CopyChecker selected={selected} />
    </div>
  );
}
