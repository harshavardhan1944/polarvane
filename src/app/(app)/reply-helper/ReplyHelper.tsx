"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Copy, Loader2, MessageSquareReply, Quote } from "lucide-react";
import type { ReplyGroup, ReplyPlan } from "@/lib/replies";
import { makeReplies } from "./actions";

type Stats = { posts: number; questions: number; noReply: number; unknown: number };

function GroupCard({ g }: { g: ReplyGroup }) {
  const [draft, setDraft] = useState(g.draft);
  const [copied, setCopied] = useState(false);
  const hasPlaceholder = /\[(confirm|link)/i.test(draft);

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <li className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-sm font-medium">{g.question}</p>
        <span className="text-xs text-faint">
          {g.count} unanswered {g.count === 1 ? "comment" : "comments"}
          {g.likes > 0 && ` · ${g.likes} likes`}
        </span>
      </div>
      <ul className="space-y-1">
        {g.examples.map((t) => (
          <li key={t} className="flex gap-1.5 text-xs text-faint">
            <Quote size={11} className="mt-0.5 shrink-0" />
            <span className="italic">{t}</span>
          </li>
        ))}
      </ul>
      <div>
        <p className="mb-1 text-xs text-muted">Draft reply (edit before posting)</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-navy-600 bg-navy-900 p-3 text-sm outline-none focus:border-brand-blue/60"
        />
      </div>
      {g.confirm.length > 0 && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-2.5">
          <p className="text-xs font-medium text-amber-200">Confirm before posting</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-100/80">
            {g.confirm.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-navy-600 px-3 py-1.5 text-xs hover:bg-navy-800"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy reply"}
        </button>
        {hasPlaceholder && <span className="text-xs text-amber-200/90">Fill in the [ ] parts first.</span>}
      </div>
    </li>
  );
}

export function ReplyHelper({ dashboardId, stats }: { dashboardId: string; stats: Stats }) {
  const [plan, setPlan] = useState<ReplyPlan | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const knownReplies = stats.questions - stats.unknown > 0;

  function run() {
    setError("");
    start(async () => {
      const res = await makeReplies(dashboardId);
      if (!res.ok) {
        setPlan(null);
        return setError(res.message);
      }
      setPlan(res.plan);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs text-muted">Customer questions</p>
          <p className="mt-1 font-display text-2xl">{stats.questions}</p>
          <p className="text-[11px] text-faint">across {stats.posts} posts</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted">No replies yet</p>
          <p className="mt-1 font-display text-2xl text-amber-200">{knownReplies ? stats.noReply : "—"}</p>
          <p className="text-[11px] text-faint">nobody has answered these</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted">Reply status unknown</p>
          <p className="mt-1 font-display text-2xl">{stats.unknown}</p>
          <p className="text-[11px] text-faint">reply count wasn’t collected</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={pending || stats.questions === 0}
          className="brand-gradient inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <MessageSquareReply size={15} />}
          {pending ? "Drafting replies…" : "Draft replies to unanswered questions"}
        </button>
      </div>
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-300">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {plan && (
        <section className="space-y-3">
          <p className="text-xs text-faint">
            Similar questions are grouped together. Based on {plan.questionsUsed} unanswered questions. Replies are drafts: the
            AI doesn’t know your product facts, so check every [confirm] part before posting.
          </p>
          <ul className="space-y-4">
            {plan.groups.map((g) => (
              <GroupCard key={g.question} g={g} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
