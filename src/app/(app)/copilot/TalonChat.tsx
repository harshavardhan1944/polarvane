"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, ArrowUp, Heart, Loader2, Sparkles } from "lucide-react";
import type { ChatTurn, TalonEvidence } from "@/lib/talon";
import { sendToTalon } from "./actions";

type Message =
  | { role: "user"; text: string }
  | { role: "talon"; text: string; evidence: TalonEvidence[]; total: number; sampled: boolean }
  | { role: "error"; text: string };

const SUGGESTIONS = [
  "What topics does my audience talk about most?",
  "What do people like most, and what do they dislike?",
  "Which topics get the most positive reactions?",
  "Has sentiment changed over time?",
  "Give me 5 content ideas based on what my audience asks for.",
];

export function TalonChat({ posts }: { posts: { id: string; label: string }[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [postId, setPostId] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

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

  return (
    <div className="panel flex min-h-[70vh] flex-col">
      {/* Scope */}
      <div className="flex flex-col gap-2 border-b border-navy-700 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">Talon answers only from your analyzed comments.</p>
        <select
          aria-label="Which posts Talon should use"
          value={postId}
          onChange={(e) => setPostId(e.target.value)}
          disabled={pending}
          className="rounded-lg border border-navy-700 bg-navy-900 px-3 py-1.5 text-xs text-ink outline-none focus:border-brand-blue"
        >
          <option value="">All analyzed posts</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Conversation */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg shadow-brand-violet/30">
              <Sparkles size={22} className="text-white" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Ask Talon about your audience</h2>
            <p className="mt-1 max-w-md text-sm text-muted">
              Every answer is based on your real comments, with quotes as evidence.
            </p>
            <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border border-navy-600 bg-navy-850 px-3 py-1.5 text-xs text-muted transition-colors hover:border-brand-blue/60 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-blue/20 px-4 py-2.5 text-sm text-ink">
                {m.text}
              </p>
            </div>
          ) : m.role === "error" ? (
            <p key={i} className="flex items-start gap-2 rounded-lg border border-negative/30 bg-negative/10 p-3 text-sm text-red-200">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {m.text}
            </p>
          ) : (
            <div key={i} className="flex gap-3">
              <div className="brand-gradient mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
                <Sparkles size={14} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <FormattedText text={m.text} />
                {m.evidence.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Evidence from comments</p>
                    {m.evidence.map((e) => (
                      <blockquote key={e.id} className="rounded-lg border border-navy-700 bg-navy-900/60 p-3">
                        <p className="text-sm text-ink">“{e.text}”</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-faint">
                          {e.author_username && <span>@{e.author_username}</span>}
                          {e.sentiment && (
                            <span className="inline-flex items-center gap-1 capitalize">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  e.sentiment === "positive" ? "bg-positive" : e.sentiment === "negative" ? "bg-negative" : "bg-neutral"
                                }`}
                              />
                              {e.sentiment}
                            </span>
                          )}
                          {e.like_count !== null && (
                            <span className="inline-flex items-center gap-1">
                              <Heart size={11} /> {e.like_count}
                            </span>
                          )}
                        </p>
                      </blockquote>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-faint">
                  Based on {m.total.toLocaleString()} analyzed comments
                  {m.sampled ? " (quotes drawn from a representative sample)" : ""}. AI can make mistakes; check the
                  evidence.
                </p>
              </div>
            </div>
          ),
        )}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={15} className="animate-spin text-brand-blue" /> Talon is reading your comments…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="border-t border-navy-700 p-3 sm:p-4"
      >
        <div className="flex items-end gap-2 rounded-xl border border-navy-700 bg-navy-900 p-2 focus-within:border-brand-blue">
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
      </form>
    </div>
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
