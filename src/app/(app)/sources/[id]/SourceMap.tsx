"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, MapPin, Sparkles, Star } from "lucide-react";
import { analyzeScan } from "../actions";

export type MapSource = {
  name: string;
  type: string;
  engagement_count: number;
  unit: string;
  avg_rating: number | null;
  where_list: string[];
  note: string;
  rank_index: number;
  mentions: number;
  change: number | null; // % change vs the previous scan of this brand
};

export function SourceMap({
  scanId,
  sources,
  initialSelected,
  status,
  previousLabel,
}: {
  scanId: string;
  sources: MapSource[];
  initialSelected: string[];
  status: string;
  previousLabel: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const total = sources.reduce((a, s) => a + s.engagement_count, 0) || 1;
  const covered = sources.filter((s) => selected.has(s.name)).reduce((a, s) => a + s.engagement_count, 0);
  const busy = pending || status === "analyzing";

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const run = () =>
    start(async () => {
      setError(null);
      const res = await analyzeScan(scanId, [...selected]);
      if (!res.ok) setError(res.message);
      router.refresh();
    });

  if (!sources.length)
    return (
      <div className="panel p-5 text-sm text-muted">
        No customer engagement was found on the connected sources. Check the spelling, add a market, or connect more sources below.
      </div>
    );

  return (
    <div className="panel p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Busiest sources for this brand</h2>
        <p className="text-xs text-faint">
          Live counts · bar is log-scaled, 100 = busiest{previousLabel ? ` · change vs ${previousLabel}` : ""}
        </p>
      </div>
      <div className="divide-y divide-navy-700">
        {sources.map((s, i) => {
          const on = selected.has(s.name);
          return (
            <label
              key={s.name}
              className={`grid cursor-pointer grid-cols-[22px_1fr_44px] items-start gap-3 py-3.5 sm:grid-cols-[28px_22px_1.3fr_1fr_44px] ${on ? "" : "opacity-55"}`}
            >
              <span className="num hidden pt-0.5 text-center text-sm text-faint sm:block">#{i + 1}</span>
              <input type="checkbox" checked={on} onChange={() => toggle(s.name)} disabled={busy} className="mt-1 h-4 w-4 accent-[#1fae7e]" aria-label={`Analyze ${s.name}`} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {s.name}
                  <span className="rounded border border-navy-600 px-1.5 text-[11px] font-normal text-muted">{s.type}</span>
                  {s.avg_rating ? (
                    <span className="inline-flex items-center gap-0.5 rounded border border-navy-600 px-1.5 text-[11px] font-normal text-amber-200">
                      <Star size={10} className="fill-current" /> {s.avg_rating.toFixed(1)}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  <span className="num text-base text-ink">{s.engagement_count.toLocaleString("en-IN")}</span> {s.unit}
                  {s.change !== null && (
                    <span className={`ml-2 ${s.change > 0 ? "text-emerald-300" : s.change < 0 ? "text-red-300" : "text-faint"}`}>
                      {s.change > 0 ? "▲" : s.change < 0 ? "▼" : "·"} {Math.abs(s.change)}%
                    </span>
                  )}
                </p>
                {s.where_list.length > 0 && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-faint">
                    <MapPin size={12} className="mt-0.5 shrink-0" /> {s.where_list.join(" · ")}
                  </p>
                )}
                {s.note && <p className="mt-1 text-xs text-faint">{s.note}</p>}
              </div>
              <div className="hidden pt-1.5 sm:block">
                <div className="h-2.5 overflow-hidden rounded-full bg-navy-800">
                  <div className="brand-gradient h-full rounded-full" style={{ width: `${Math.max(s.rank_index, 3)}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-faint">{s.mentions} reviews/posts read</p>
              </div>
              <span className="num pt-0.5 text-right text-base">{s.rank_index}</span>
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-navy-700 pt-4">
        <p className="text-sm text-muted">
          <b className="text-ink">{selected.size}</b> of {sources.length} selected · covers{" "}
          <b className="text-ink">{Math.round((100 * covered) / total)}%</b> of measured engagement
        </p>
        <button
          onClick={run}
          disabled={busy || selected.size === 0}
          className="brand-gradient inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? "Analyzing… (up to a minute)" : status === "analyzed" ? "Re-analyze selected" : "Analyze selected"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-negative/30 bg-negative/10 p-3 text-sm text-red-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
