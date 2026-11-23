import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/NotBuiltYet";
import { SentimentBar, SentimentLegend } from "@/components/charts";
import { NOT_YET_CONNECTED } from "@/lib/sources/connectors";
import type { ScanAnalysis } from "@/lib/sources/engine";
import { createClient } from "@/lib/supabase/server";
import { deleteScan } from "../actions";
import { SourceMap, type MapSource } from "./SourceMap";

export const instant = false;
// Analysis runs AI over up to ~1,200 mentions.
export const maxDuration = 300;

type SourceRow = Omit<MapSource, "mentions" | "change"> & { status: string };

const dateLabel = (d: string) => new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function ScanPage(props: PageProps<"/sources/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const { data: scan } = await supabase
    .from("source_scans")
    .select("id, brand, market, status, error_message, selected_sources, analysis, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!scan) notFound();

  const { data: rows } = await supabase
    .from("scan_sources")
    .select("name, type, status, engagement_count, unit, avg_rating, where_list, note, rank_index")
    .eq("scan_id", id);
  const all = ((rows ?? []) as SourceRow[]).map((r) => ({ ...r, engagement_count: Number(r.engagement_count) }));

  // How many real reviews/posts were collected from each source.
  const counts = new Map<string, number>();
  await Promise.all(
    all.map(async (r) => {
      const { count } = await supabase
        .from("scan_mentions")
        .select("id", { count: "exact", head: true })
        .eq("scan_id", id)
        .eq("source", r.name);
      counts.set(r.name, count ?? 0);
    }),
  );

  // Trend: compare with the previous scan of the same brand.
  const { data: prev } = await supabase
    .from("source_scans")
    .select("id, created_at, scan_sources(name, engagement_count, status)")
    .ilike("brand", scan.brand.replace(/[%_\\]/g, (m: string) => `\\${m}`))
    .lt("created_at", scan.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prevCounts = new Map<string, number>(
    ((prev?.scan_sources ?? []) as { name: string; engagement_count: number; status: string }[])
      .filter((p) => p.status === "ok")
      .map((p) => [p.name, Number(p.engagement_count)]),
  );

  const ranked: MapSource[] = all
    .filter((r) => r.status === "ok" && r.engagement_count > 0)
    .sort((a, b) => b.engagement_count - a.engagement_count)
    .map((r) => {
      const before = prevCounts.get(r.name);
      return {
        ...r,
        mentions: counts.get(r.name) ?? 0,
        change: before ? Math.round(((r.engagement_count - before) / before) * 100) : null,
      };
    });
  const empty = all.filter((r) => r.status === "empty");
  const unavailable = all.filter((r) => r.status === "needs_key" || r.status === "error");
  const analysis = scan.analysis as ScanAnalysis | null;

  return (
    <>
      <Link href="/sources" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
        <ArrowLeft size={13} /> All scans
      </Link>
      <PageHeader
        title={`Where ${scan.brand}’s customers talk`}
        subtitle={`${scan.market ? `${scan.market} · ` : ""}Scanned ${dateLabel(scan.created_at)}${
          ranked[0] ? ` · Busiest: ${ranked[0].name} (${ranked[0].type})` : ""
        }`}
      />

      {scan.status === "failed" && scan.error_message && (
        <p className="panel mb-4 border-negative/30 p-4 text-sm text-red-200">{scan.error_message}</p>
      )}

      <SourceMap
        scanId={scan.id}
        sources={ranked}
        initialSelected={(scan.selected_sources as string[]) ?? []}
        status={scan.status}
        previousLabel={prev ? dateLabel(prev.created_at) : null}
      />

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <MiniList title="No activity found" hint="skip these" items={empty.map((r) => ({ name: r.name, detail: r.note || "Nothing about this brand found here." }))} />
        <MiniList title="Not connected" items={unavailable.map((r) => ({ name: r.name, detail: r.note }))} />
        <MiniList title="Coming next" items={NOT_YET_CONNECTED} />
      </div>

      {analysis && <AnalysisView a={analysis} />}

      <form action={deleteScan} className="mt-10">
        <input type="hidden" name="id" value={scan.id} />
        <button className="inline-flex items-center gap-1.5 text-xs text-faint hover:text-red-300">
          <Trash2 size={13} /> Delete this scan
        </button>
      </form>
    </>
  );
}

function MiniList({ title, hint, items }: { title: string; hint?: string; items: { name: string; detail: string }[] }) {
  return (
    <div className="panel p-4">
      <h3 className="mb-2 text-sm font-medium">
        {title} {hint && <span className="font-normal text-faint">· {hint}</span>}
      </h3>
      {items.length ? (
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.name} className="rounded-lg border border-dashed border-navy-700 bg-navy-900/60 p-2.5 text-xs">
              <p className="font-medium text-ink">{i.name}</p>
              <p className="mt-0.5 text-muted">{i.detail}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-faint">None</p>
      )}
    </div>
  );
}

const MOOD: Record<string, string> = {
  positive: "border-positive/30 bg-positive/10 text-emerald-200",
  negative: "border-negative/30 bg-negative/10 text-red-200",
  mixed: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  neutral: "border-navy-600 bg-navy-800 text-muted",
};

function AnalysisView({ a }: { a: ScanAnalysis }) {
  const totals = a.sources.reduce(
    (acc, s) => ({
      positive: acc.positive + s.counts.positive,
      neutral: acc.neutral + s.counts.neutral,
      negative: acc.negative + s.counts.negative,
    }),
    { positive: 0, neutral: 0, negative: 0 },
  );
  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">What customers are saying</h2>
        <p className="text-xs text-faint">
          {a.total.toLocaleString("en-IN")} real mentions read ·{" "}
          {a.engine === "gemini" ? "star ratings + Gemini" : "star ratings + keyword rules"} · {dateLabel(a.generated_at)}
        </p>
      </div>
      {a.engine_note && <p className="mb-3 text-xs text-amber-200">{a.engine_note}</p>}

      <div className="panel p-5">
        <p className="text-sm leading-relaxed">{a.summary}</p>
        {a.total > 0 && (
          <div className="mt-4">
            <SentimentBar counts={totals} />
            <div className="mt-2">
              <SentimentLegend counts={totals} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {a.sources.map((s) => (
          <div key={s.name} className="panel p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">{s.name}</h3>
              <span className="text-xs text-faint">{s.analyzed} read</span>
            </div>
            {s.analyzed > 0 ? (
              <div className="mt-3">
                <SentimentBar counts={s.counts} height={10} />
              </div>
            ) : (
              <p className="mt-2 text-xs text-faint">No review text collected from this source; ranking uses its live counts only.</p>
            )}
            {s.praise.length > 0 && <Tags label="Praise" items={s.praise} cls="border-positive/30 text-emerald-200" />}
            {s.complaints.length > 0 && <Tags label="Complaints" items={s.complaints} cls="border-negative/30 text-red-200" />}
            {s.examples.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {s.examples.map((e, i) => (
                  <blockquote
                    key={i}
                    className={`rounded-r-lg border-l-2 bg-navy-900/60 px-3 py-2 text-xs leading-relaxed text-ink ${
                      e.sentiment === "positive" ? "border-positive" : e.sentiment === "negative" ? "border-negative" : "border-neutral"
                    }`}
                  >
                    {e.text}
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-faint">
                      {e.rating ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-200">
                          <Star size={10} className="fill-current" /> {e.rating}
                        </span>
                      ) : null}
                      {e.posted_at && <span>{e.posted_at}</span>}
                      {e.url && (
                        <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-ink">
                          Open <ExternalLink size={10} />
                        </a>
                      )}
                    </span>
                  </blockquote>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="panel p-5">
          <h3 className="mb-3 text-sm font-medium">Themes across sources</h3>
          {a.themes.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="pb-2 font-normal">Theme</th>
                  <th className="pb-2 font-normal">Where</th>
                  <th className="pb-2 text-right font-normal">Mentions</th>
                  <th className="pb-2 text-right font-normal">Mood</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {a.themes.map((t) => (
                  <tr key={t.theme}>
                    <td className="py-2 pr-2">{t.theme}</td>
                    <td className="py-2 pr-2 text-xs text-muted">{t.sources.join(", ")}</td>
                    <td className="num py-2 text-right">{t.mentions}</td>
                    <td className="py-2 text-right">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${MOOD[t.mood]}`}>{t.mood}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-faint">No clear themes yet.</p>
          )}
        </div>
        <div className="panel p-5">
          <h3 className="mb-3 text-sm font-medium">What to do next</h3>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            {a.actions.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Tags({ label, items, cls }: { label: string; items: string[]; cls: string }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span key={t} className={`rounded-md border bg-navy-900/60 px-2 py-0.5 text-xs ${cls}`}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
