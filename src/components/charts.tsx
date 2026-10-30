// Lightweight, dependency-free charts. Pure HTML/CSS, hover tooltips via CSS.
import type { DayStat, TopicStat } from "@/lib/insights";

const SENT = [
  { key: "positive", label: "Positive", bar: "bg-positive" },
  { key: "neutral", label: "Neutral", bar: "bg-neutral" },
  { key: "negative", label: "Negative", bar: "bg-negative" },
] as const;

type Counts = { positive: number; neutral: number; negative: number };

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-navy-600 bg-navy-900 px-2 py-1 text-[11px] text-ink shadow-xl group-hover:block">
      {children}
    </span>
  );
}

export function SentimentLegend({ counts }: { counts: Counts }) {
  const total = counts.positive + counts.neutral + counts.negative;
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
      {SENT.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-ink">
          <span className={`h-2.5 w-2.5 rounded-full ${s.bar}`} />
          {s.label}
          <span className="font-medium">{pct(counts[s.key], total)}%</span>
          <span className="text-faint">({counts[s.key].toLocaleString()})</span>
        </span>
      ))}
    </div>
  );
}

export function SentimentBar({ counts, height = 12 }: { counts: Counts; height?: number }) {
  const total = counts.positive + counts.neutral + counts.negative;
  return (
    <div className="flex w-full gap-[2px]" style={{ height }}>
      {SENT.filter((s) => counts[s.key] > 0).map((s) => (
        <div
          key={s.key}
          className={`group relative h-full rounded-[4px] ${s.bar} transition-opacity hover:opacity-80`}
          style={{ width: `${(counts[s.key] / total) * 100}%` }}
        >
          <Tip>
            {s.label}: {counts[s.key].toLocaleString()} ({pct(counts[s.key], total)}%)
          </Tip>
        </div>
      ))}
      {total === 0 && <div className="h-full w-full rounded-[4px] bg-navy-700" />}
    </div>
  );
}

export function TopicBars({ topics, max = 10 }: { topics: TopicStat[]; max?: number }) {
  const shown = topics.slice(0, max);
  const top = shown[0]?.total ?? 0;
  if (shown.length === 0)
    return <p className="text-sm text-muted">No clear topics were found in these comments.</p>;
  return (
    <div className="space-y-3">
      {shown.map((t) => (
        <div key={t.topic}>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="capitalize text-ink">{t.topic}</span>
            <span className="text-muted">
              {t.total.toLocaleString()} {t.total === 1 ? "comment" : "comments"} ·{" "}
              <span className="text-faint">{pct(t.positive, t.total)}% positive</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-navy-800">
            <div className="flex h-full gap-[2px]" style={{ width: `${Math.max(4, (t.total / top) * 100)}%` }}>
              {SENT.filter((s) => t[s.key] > 0).map((s) => (
                <div
                  key={s.key}
                  className={`group relative h-full rounded-[4px] ${s.bar}`}
                  style={{ width: `${(t[s.key] / t.total) * 100}%` }}
                >
                  <Tip>
                    <span className="capitalize">{t.topic}</span> · {s.label}: {t[s.key]}
                  </Tip>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      {topics.length > max && (
        <p className="text-xs text-faint">+ {topics.length - max} smaller topics</p>
      )}
    </div>
  );
}

export function TrendColumns({ days }: { days: DayStat[] }) {
  const shown = days.slice(-30);
  const max = Math.max(...shown.map((d) => d.positive + d.neutral + d.negative), 1);
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <div>
      <div className="flex h-40 items-end gap-1 border-b border-navy-700">
        {shown.map((d) => {
          const total = d.positive + d.neutral + d.negative;
          return (
            <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
              <Tip>
                {fmt(d.date)} · {total} comments · {d.positive} pos / {d.neutral} neu / {d.negative} neg
              </Tip>
              <div
                className="flex flex-col-reverse gap-[2px] group-hover:opacity-80"
                style={{ height: `${(total / max) * 100}%` }}
              >
                {SENT.filter((s) => d[s.key] > 0).map((s, i, arr) => (
                  <div
                    key={s.key}
                    className={`${s.bar} ${i === arr.length - 1 ? "rounded-t-[4px]" : ""}`}
                    style={{ flexGrow: d[s.key], minHeight: 2 }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-faint">
        <span>{fmt(shown[0].date)}</span>
        {shown.length > 1 && <span>{fmt(shown[shown.length - 1].date)}</span>}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        {SENT.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${s.bar}`} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
