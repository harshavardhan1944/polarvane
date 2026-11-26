"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Search } from "lucide-react";
import type { RedditSearchHit } from "@/lib/reddit";
import { addThreads, checkSearch, startSearch } from "./reddit-actions";

const TIMES = [
  { v: "month", label: "Past month" },
  { v: "year", label: "Past year" },
  { v: "all", label: "All time" },
  { v: "week", label: "Past week" },
];

export function RedditSearch({ dashboardId = "" }: { dashboardId?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [time, setTime] = useState("year");
  const [phase, setPhase] = useState<"" | "searching" | "adding">("");
  const [hits, setHits] = useState<RedditSearchHit[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [limit, setLimit] = useState(200);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function search() {
    setError("");
    setDone("");
    setHits(null);
    setPicked([]);
    setPhase("searching");
    try {
      const s = await startSearch(query, time);
      if (!s.ok) throw new Error(s.message);
      // Reddit searches take about 20–90 seconds on Apify.
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const r = await checkSearch(s.ticket);
        if (!r.ok) throw new Error(r.message);
        if (r.status === "done") {
          setHits(r.hits);
          // Pre-tick the 3 busiest threads.
          setPicked(r.hits.slice(0, 3).map((h) => h.url));
          if (!r.hits.length) setError("No Reddit threads found. Try a different word or a longer time range.");
          return;
        }
      }
      throw new Error("The search is taking too long. Please try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed. Please try again.");
    } finally {
      setPhase("");
    }
  }

  async function add() {
    setError("");
    setDone("");
    setPhase("adding");
    try {
      const r = await addThreads(picked, dashboardId, limit);
      if (!r.ok) throw new Error(r.message);
      const parts = [`${r.added} thread${r.added === 1 ? "" : "s"} added`];
      if (r.started) parts.push(`${r.started} collecting now`);
      if (r.added > r.started) parts.push(`${r.added - r.started} waiting: click “Collect comments” on them below when the others finish`);
      if (r.skipped) parts.push(`${r.skipped} already in your list`);
      setDone(parts.join(" · "));
      setHits(null);
      setPicked([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t add the threads.");
    } finally {
      setPhase("");
    }
  }

  const busy = phase !== "";
  const toggle = (url: string) => setPicked((p) => (p.includes(url) ? p.filter((x) => x !== url) : p.length >= 10 ? p : [...p, url]));
  const est = picked.length * limit;

  return (
    <div className="panel space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-sm font-medium">Search Reddit</h2>
        <p className="mt-0.5 text-xs text-faint">No link needed: type a brand or product, pick the threads, and Polarvane collects their comments.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void search();
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={80}
            disabled={busy}
            placeholder="e.g. Schwarzkopf, Schwarzkopf Igora, Bonacure shampoo"
            className="w-full rounded-lg border border-navy-700 bg-navy-900 py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-faint focus:border-brand-blue"
          />
        </div>
        <select
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={busy}
          className="rounded-lg border border-navy-700 bg-navy-900 px-3 py-2.5 text-sm outline-none"
        >
          {TIMES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || query.trim().length < 2}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "searching" ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          {phase === "searching" ? "Searching Reddit… (up to 1–2 min)" : "Search"}
        </button>
      </form>
      <p className="text-[11px] text-faint">Uses the Apify Reddit scraper: a search of 25 threads costs about $0.10.</p>

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-300">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
      {done && (
        <p className="flex items-start gap-1.5 text-xs text-emerald-300">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> {done}
        </p>
      )}

      {hits && hits.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            {hits.length} threads found, busiest first. Tick the ones about the brand (up to 10).
          </p>
          <ul className="max-h-96 divide-y divide-navy-700 overflow-y-auto rounded-lg border border-navy-700">
            {hits.map((h) => (
              <li key={h.url}>
                <label className="flex cursor-pointer gap-3 p-3 hover:bg-navy-850">
                  <input
                    type="checkbox"
                    checked={picked.includes(h.url)}
                    onChange={() => toggle(h.url)}
                    className="mt-1 h-4 w-4 accent-[#5b8cff]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{h.title}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-faint">
                      {h.community && <span>{h.community}</span>}
                      {h.comments != null && <span>{h.comments.toLocaleString()} comments</span>}
                      {h.upvotes != null && <span>{h.upvotes.toLocaleString()} upvotes</span>}
                      {h.date && <span>{new Date(h.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>}
                      <a href={h.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brand-blue hover:underline">
                        open <ExternalLink size={10} />
                      </a>
                    </p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-xs text-muted">
              Collect up to
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                disabled={busy}
                className="rounded-md border border-navy-700 bg-navy-850 px-2 py-1 text-xs text-ink outline-none"
              >
                {[50, 200, 500, 1000].map((n) => (
                  <option key={n} value={n}>
                    {n} comments
                  </option>
                ))}
              </select>
              per thread
            </label>
            <span className="text-xs text-faint">
              Max cost about ${((est / 1000) * 3.4).toFixed(2)} (you pay only for comments actually collected)
            </span>
            <button
              onClick={add}
              disabled={busy || picked.length === 0}
              className="brand-gradient inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:ml-auto"
            >
              {phase === "adding" && <Loader2 size={14} className="animate-spin" />}
              Add {picked.length} thread{picked.length === 1 ? "" : "s"} and collect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
