"use client";

import { useState } from "react";
import { Link2, Search } from "lucide-react";
import { NewAnalysisForm } from "./NewAnalysisForm";
import { RedditSearch } from "./RedditSearch";

// Add Reddit threads: search by brand (default) or paste a thread link.
export function RedditAdder({ dashboardId = "" }: { dashboardId?: string }) {
  const [mode, setMode] = useState<"search" | "link">("search");
  const pill = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
      active ? "border-brand-blue/60 bg-brand-blue/15 text-ink" : "border-navy-600 text-muted hover:text-ink"
    }`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setMode("search")} className={pill(mode === "search")}>
          <Search size={12} /> Search by brand or product
        </button>
        <button onClick={() => setMode("link")} className={pill(mode === "link")}>
          <Link2 size={12} /> Paste a thread link
        </button>
      </div>
      {mode === "search" ? <RedditSearch dashboardId={dashboardId} /> : <NewAnalysisForm dashboardId={dashboardId} source="reddit" />}
    </div>
  );
}
