"use client";

import { useState } from "react";
import { Camera, Link2, MessagesSquare, Search } from "lucide-react";
import { NewAnalysisForm } from "./NewAnalysisForm";
import { RedditSearch } from "./RedditSearch";

// Choose where comments come from: Instagram, or Reddit (search by brand or paste a thread link).
export function AddSource({ dashboardId = "" }: { dashboardId?: string }) {
  const [source, setSource] = useState<"instagram" | "reddit">("instagram");
  const [redditMode, setRedditMode] = useState<"search" | "link">("search");

  const tab = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm ${
      active ? "bg-navy-700 text-ink shadow" : "text-muted hover:text-ink"
    }`;
  const pill = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
      active ? "border-brand-blue/60 bg-brand-blue/15 text-ink" : "border-navy-600 text-muted hover:text-ink"
    }`;

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl border border-navy-700 bg-navy-900/60 p-1" role="tablist">
        <button role="tab" aria-selected={source === "instagram"} onClick={() => setSource("instagram")} className={tab(source === "instagram")}>
          <Camera size={15} /> Instagram
        </button>
        <button role="tab" aria-selected={source === "reddit"} onClick={() => setSource("reddit")} className={tab(source === "reddit")}>
          <MessagesSquare size={15} /> Reddit
        </button>
      </div>

      {source === "instagram" ? (
        <NewAnalysisForm dashboardId={dashboardId} source="instagram" />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setRedditMode("search")} className={pill(redditMode === "search")}>
              <Search size={12} /> Search by brand or product
            </button>
            <button onClick={() => setRedditMode("link")} className={pill(redditMode === "link")}>
              <Link2 size={12} /> Paste a thread link
            </button>
          </div>
          {redditMode === "search" ? (
            <RedditSearch dashboardId={dashboardId} />
          ) : (
            <NewAnalysisForm dashboardId={dashboardId} source="reddit" />
          )}
        </>
      )}
    </div>
  );
}
