"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, ArrowUp, Check, Copy, Heart, MessageSquarePlus, ShieldCheck, Sparkles } from "lucide-react";
import { SentimentBar } from "@/components/charts";
import type { ChatTurn, TalonEvidence } from "@/lib/talon";
import { sendToTalon } from "./actions";

export type TalonSummary = {
  total: number;
  sentiment: { positive: number; neutral: number; negative: number };
  topics: { topic: string; total: number }[];
};

export type Message =
  | { role: "user"; text: string }
  | { role: "talon"; text: string; evidence: TalonEvidence[]; total: number; sampled: boolean }
  | { role: "error"; text: string };

const SUGGESTION_GROUPS = [
  {
    label: "Audience",
    items: ["What topics does my audience talk about most?", "What questions do people ask most?"],
  },
  {
    label: "Sentiment",
    items: ["What do people like most, and what do they dislike?", "Has sentiment changed over time?"],
  },
  {
    label: "Content",
    items: [
      "Which topics get the most positive reactions?",
      "Give me 5 content ideas based on what my audience asks for.",
    ],
  },
];

export function TalonChat({
  posts,
  summary,
  initialQuestion = "",
  initialPost = "",
  initialMessages = [],
}: {
  posts: { id: string; label: string }[];
  summary: TalonSummary;
  initialQuestion?: string;
  initialPost?: string;
  initialMessages?: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [postId, setPostId] = useState(initialPost);
  const asked = useRef(false);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  // A question passed from the dashboard is asked automatically, once.
  useEffect(() => {
    if (initialQuestion && !asked.current) {
      asked.current = true;
      ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ask(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    const history: ChatTurn[] = messages
      .filter((m): m is Exclude<Message, { role: "error" }> => m.role !== "error")
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    startTransition(async () => {
      try {
        const r = await sendToTalon(q, history, postId);
        setMessages((m) => [
          ...m,
          r.ok
            ? { role: "talon", text: r.answer, evidence: r.evidence, total: r.total, sampled: r.sampled }
            : { role: "error", text: r.message },
        ]);
      } catch {
        setMessages((m) => [...m, { role: "error", text: "Lost connection. Please try again." }]);
      }
    });
  }

  const allSuggestions = SUGGESTION_GROUPS.flatMap((g) => g.items);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
      {/* Chat */}
      <div className="panel flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-navy-700 px-4 py-3">
          <span className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl shadow-lg shadow-brand-violet/30">
            <Sparkles size={17} className="text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-none">Talon</p>
            <p className="flex items-center gap-1 text-[11px] text-emerald-300">
              <ShieldCheck size={11} /> Answers grounded in your comments
            </p>
          </div>
          <select
            aria-label="Which posts Talon should use"
            value={postId}
            onChange={(e) => setPostId(e.target.value)}
            disabled={pending}
            className="max-w-[45%] rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-blue"
          >
            <option value="">All analyzed posts</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              disabled={pending}
              title="New chat"
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700 px-2.5 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-40"
            >
              <MessageSquarePlus size={14} /> <span className="hidden sm:inline">New chat</span>
            </button>
          )}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
          {messages.length === 0 && !pending && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="relative">
                <div className="brand-gradient absolute inset-0 rounded-3xl opacity-40 blur-xl" />
                <div className="brand-gradient relative flex h-14 w-14 items-center justify-center rounded-2xl">
                  <Sparkles size={24} className="text-white" />
                </div>
              </div>
              <h2 className="font-display mt-6 text-3xl leading-tight sm:text-4xl">
                What would you like to know?
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted">
                Talon reads your {summary.total.toLocaleString()} analyzed comments and answers with real quotes as
                evidence.
              </p>
              <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {allSuggestions.slice(0, 4).map((q) => (
                  <button
                    key={q}
                    onClick={() => ask(q)}
                    className="rounded-xl border border-navy-700 bg-navy-900/50 px-3.5 py-3 text-left text-xs text-muted transition-colors hover:border-brand-blue/50 hover:bg-navy-800 hover:text-ink"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="brand-gradient max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white shadow-lg shadow-brand-violet/10">
                  {m.text}
                </p>
              </div>
            ) : m.role === "error" ? (
              <p key={i} className="flex items-start gap-2 rounded-xl border border-negative/30 bg-negative/10 p-3 text-sm text-red-200">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {m.text}
              </p>
            ) : (
              <div key={i} className="flex gap-3">
                <span className="brand-gradient mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <Sparkles size={14} className="text-white" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="max-w-[68ch] rounded-2xl rounded-tl-md border border-navy-700 bg-navy-850 p-5">
                    <FormattedText text={m.text} />
                    {m.evidence.length > 0 && (
                      <div className="mt-4 border-t border-navy-700 pt-3">
                        <p className="mb-2 text-xs text-muted">Evidence from real comments</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {m.evidence.map((e) => (
                            <blockquote
                              key={e.id}
                              className={`rounded-lg border-l-2 bg-navy-850 p-3 ${
                                e.sentiment === "positive"
                                  ? "border-positive"
                                  : e.sentiment === "negative"
                                    ? "border-negative"
                                    : "border-neutral"
                              }`}
                            >
                              <p className="font-display text-[16px] leading-snug text-ink">“{e.text}”</p>
                              <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 text-[11px] text-faint">
                                {e.author_username && <span>@{e.author_username}</span>}
                                {e.sentiment && <span className="capitalize">{e.sentiment}</span>}
                                {e.like_count !== null && (
                                  <span className="inline-flex items-center gap-1">
                                    <Heart size={10} /> {e.like_count}
                                  </span>
                                )}
                              </p>
                            </blockquote>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 px-1">
                    <CopyButton text={m.text} />
                    <p className="text-[11px] text-faint">
                      Based on {m.total.toLocaleString()} analyzed comments
                      {m.sampled ? " · quotes from a representative sample" : ""} · AI can make mistakes, check the
                      evidence
                    </p>
                  </div>
                </div>
              </div>
            ),
          )}

          {pending && (
            <div className="flex items-center gap-3">
              <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-xl">
                <Sparkles size={14} className="text-white" />
              </span>
              <div className="flex items-center gap-1 rounded-2xl border border-navy-700 bg-navy-900/60 px-4 py-3">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-blue"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
                <span className="ml-2 text-xs text-muted">Reading your comments…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="border-t border-navy-700 p-3 sm:p-4"
        >
          <div className="flex items-end gap-2 rounded-xl border border-navy-600 bg-navy-900 p-2 transition-colors focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder="Ask about topics, likes and dislikes, sentiment changes, content ideas…"
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-faint"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="Send"
              className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-40"
            >
              <ArrowUp size={17} />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-faint">Enter to send · Shift + Enter for a new line</p>
        </form>
      </div>

      {/* Side panel */}
      <aside className="space-y-4">
        <div className="panel p-4">
          <p className="text-xs text-muted">What Talon knows</p>
          <p className="font-display num mt-2 text-4xl leading-none">{summary.total.toLocaleString()}</p>
          <p className="text-xs text-muted">
            analyzed comments across {posts.length} {posts.length === 1 ? "post" : "posts"}
          </p>
          <div className="mt-3">
            <SentimentBar counts={summary.sentiment} height={8} />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted">
            <span>{pctOf(summary.sentiment.positive, summary.total)}% positive</span>
            <span>{pctOf(summary.sentiment.negative, summary.total)}% negative</span>
          </div>
          {summary.topics.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] text-faint">Top topics</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.topics.map((t) => (
                  <button
                    key={t.topic}
                    onClick={() => ask(`What are people saying about ${t.topic}?`)}
                    disabled={pending}
                    className="rounded-full border border-navy-600 bg-navy-850 px-2.5 py-1 text-[11px] capitalize text-muted hover:border-brand-blue/50 hover:text-ink"
                  >
                    {t.topic} <span className="text-faint">{t.total}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panel p-4">
          <p className="text-xs text-muted">Try asking</p>
          <div className="mt-3 space-y-3">
            {SUGGESTION_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="mb-1 text-[11px] text-brand-blue">{g.label}</p>
                {g.items.map((q) => (
                  <button
                    key={q}
                    onClick={() => ask(q)}
                    disabled={pending}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-muted hover:bg-navy-800 hover:text-ink disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function pctOf(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className="inline-flex items-center gap-1 text-[11px] text-faint hover:text-ink"
    >
      {done ? <Check size={11} /> : <Copy size={11} />} {done ? "Copied" : "Copy"}
    </button>
  );
}

// Renders Talon's plain-text answer: paragraphs, "- " bullets and **bold**.
function FormattedText({ text }: { text: string }) {
  const blocks: { type: "p" | "ul"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ type: "p", lines: [] });
      continue;
    }
    const isBullet = /^[-•*]\s+/.test(line);
    const last = blocks[blocks.length - 1];
    if (isBullet) {
      const item = line.replace(/^[-•*]\s+/, "");
      if (last?.type === "ul") last.lines.push(item);
      else blocks.push({ type: "ul", lines: [item] });
    } else if (last?.type === "p" && last.lines.length) last.lines.push(line);
    else blocks.push({ type: "p", lines: [line] });
  }
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      ) : (
        part
      ),
    );
  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink/90">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.type === "ul" ? (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-brand-blue">
              {b.lines.map((l, j) => (
                <li key={j}>{bold(l)}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{bold(b.lines.join(" "))}</p>
          ),
        )}
    </div>
  );
}
