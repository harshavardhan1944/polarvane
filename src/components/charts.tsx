// Lightweight, dependency-free charts. Pure HTML/CSS, hover tooltips via CSS.
import type { DayStat, TopicStat } from "@/lib/insights-core";

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

const SENT_HEX = { positive: "#1fae7e", neutral: "#6b7a99", negative: "#e5534b" } as const;

// Part-to-whole donut for the three sentiments, with the headline in the middle.
export function SentimentDonut({ counts, size = 168 }: { counts: Counts; size?: number }) {
  const total = counts.positive + counts.neutral + counts.negative;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = total && SENT.filter((s) => counts[s.key] > 0).length > 1 ? 4 : 0;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#18224a" strokeWidth={stroke} />
        {total > 0 &&
          SENT.filter((s) => counts[s.key] > 0).map((s) => {
            const len = (counts[s.key] / total) * c;
            const seg = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={SENT_HEX[s.key]}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
                className="transition-opacity hover:opacity-80"
              >
                <title>
                  {s.label}: {counts[s.key]} ({pct(counts[s.key], total)}%)
                </title>
              </circle>
            );
            offset += len;
            return seg;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-semibold tracking-tight">{pct(counts.positive, total)}%</span>
        <span className="text-xs text-muted">positive</span>
      </div>
    </div>
  );
}

export function SentimentRows({ counts }: { counts: Counts }) {
  const total = counts.positive + counts.neutral + counts.negative;
  return (
    <div className="w-full space-y-3">
      {SENT.map((s) => (
        <div key={s.key}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="inline-flex items-center gap-2 text-ink">
              <span className={`h-2.5 w-2.5 rounded-full ${s.bar}`} />
              {s.label}
            </span>
            <span className="text-ink">
              <span className="font-semibold">{pct(counts[s.key], total)}%</span>{" "}
              <span className="text-xs text-faint">{counts[s.key].toLocaleString()}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-navy-800">
            <div
              className={`h-full rounded-full ${s.bar}`}
              style={{ width: `${pct(counts[s.key], total)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
