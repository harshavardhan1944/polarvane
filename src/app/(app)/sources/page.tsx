import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/NotBuiltYet";
import { connectorStatus } from "@/lib/sources/connectors";
import { createClient } from "@/lib/supabase/server";
import { ScanForm } from "./ScanForm";

export const instant = false;
// A scan queries every source at once; Apify sources can take up to ~3 minutes.
export const maxDuration = 300;

const STATUS: Record<string, { label: string; cls: string }> = {
  scanning: { label: "Scanning", cls: "border-brand-blue/30 bg-brand-blue/10 text-blue-200" },
  ranked: { label: "Sources ranked", cls: "border-navy-600 bg-navy-800 text-muted" },
  analyzing: { label: "Analyzing", cls: "border-brand-violet/30 bg-brand-violet/10 text-violet-200" },
  analyzed: { label: "Analyzed", cls: "border-positive/30 bg-positive/10 text-emerald-200" },
  failed: { label: "Failed", cls: "border-negative/30 bg-negative/10 text-red-200" },
};

export default async function SourcesPage() {
  const supabase = await createClient();
  const { data: scans, error } = await supabase
    .from("source_scans")
    .select("id, brand, market, status, created_at, scan_sources(name, engagement_count, rank_index, status)")
    .order("created_at", { ascending: false })
    .limit(30);
  const tableMissing = error && /does not exist|could not find the table|schema cache/i.test(error.message);
  const status = connectorStatus();
  const paidAvailable = status.some((c) => c.paid && !c.missing);

  return (
    <>
      <PageHeader
        title="Find sources"
        subtitle="Every brand’s customers talk somewhere different. Polarvane checks every source, ranks where this brand’s customers actually engage, then analyzes only those."
      />

      {tableMissing ? (
        <div className="panel mb-6 border-amber-400/30 p-5 text-sm text-amber-200">
          One-time setup: run <code className="text-amber-100">supabase/migrations/008_source_scans.sql</code> in Supabase’s SQL editor, then refresh this page.
        </div>
      ) : (
        <ScanForm paidAvailable={paidAvailable} />
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {status.map((c) => (
          <span
            key={c.name}
            title={c.missing ? `Add ${c.missing} in Vercel to enable` : "Connected"}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              c.missing ? "border-navy-700 text-faint" : "border-positive/30 text-emerald-200"
            }`}
          >
            {c.missing ? "○" : "●"} {c.name}
            {c.paid && !c.missing ? " · Apify" : ""}
          </span>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-medium text-muted">Recent scans</h2>
      {!scans?.length ? (
        <p className="panel p-5 text-sm text-muted">No scans yet. Type a brand above to find where its customers talk.</p>
      ) : (
        <div className="panel divide-y divide-navy-700">
          {scans.map((s) => {
            const srcs = ((s.scan_sources ?? []) as { name: string; engagement_count: number; rank_index: number; status: string }[])
              .filter((x) => x.status === "ok" && x.rank_index > 0)
              .sort((a, b) => b.rank_index - a.rank_index);
            const badge = STATUS[s.status] ?? STATUS.ranked;
            return (
              <Link key={s.id} href={`/sources/${s.id}`} className="flex items-center gap-4 p-4 hover:bg-navy-850">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {s.brand}
                    {s.market && <span className="text-muted"> · {s.market}</span>}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {srcs.length
                      ? `Top: ${srcs.slice(0, 3).map((x) => x.name).join(" → ")}`
                      : "No engagement found"}{" "}
                    ·{" "}
                    {new Date(s.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
                  </p>
                </div>
                <span className={`hidden rounded-full border px-2.5 py-1 text-xs sm:inline ${badge.cls}`}>{badge.label}</span>
                <ChevronRight size={16} className="text-faint" />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
