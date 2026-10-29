import Link from "next/link";
import { ArrowRight, MessageSquareText, Smile, Tags, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/NotBuiltYet";

const TILES = [
  { label: "Comments analyzed", icon: MessageSquareText },
  { label: "Positive sentiment", icon: Smile },
  { label: "Topics found", icon: Tags },
  { label: "Posts analyzed", icon: TrendingUp },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Audience sentiment and topics across the Instagram posts you analyze."
      />

      {/* Empty-state metric tiles: we show a dash, never a made-up number */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map(({ label, icon: Icon }) => (
          <div key={label} className="panel p-4">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs">{label}</span>
              <Icon size={15} className="text-faint" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-faint">—</p>
            <p className="mt-1 text-xs text-faint">No data yet</p>
          </div>
        ))}
      </div>

      <div className="panel relative mt-6 overflow-hidden p-6 sm:p-8">
        <div className="brand-gradient pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl" />
        <p className="text-xs font-medium uppercase tracking-wider text-brand-blue">Get started</p>
        <h2 className="mt-2 text-xl font-semibold">Analyze your first Instagram post</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Paste a public post or Reel link. Polarvane collects the available comments, classifies
          each one as positive, neutral or negative, and groups them into topics. Charts appear here
          once real data exists.
        </p>
        <Link
          href="/analyze"
          className="brand-gradient mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-violet/20 hover:opacity-95"
        >
          New analysis <ArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}
