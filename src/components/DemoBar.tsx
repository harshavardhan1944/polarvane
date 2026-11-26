"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2 } from "lucide-react";
import { loadDemoBrand, removeDemoBrand } from "@/app/(app)/demo-actions";

// Load or remove the sample brand used for demos and interviews.
export function DemoBar({ loaded }: { loaded: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  function run(kind: "load" | "remove") {
    setMsg("");
    start(async () => {
      const r = kind === "load" ? await loadDemoBrand() : await removeDemoBrand();
      if (!r.ok) return setMsg(r.message);
      if (r.note) setMsg(r.note);
      router.push(kind === "load" && r.dashboardId ? `/?d=${r.dashboardId}` : "/");
      router.refresh();
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-navy-600 px-4 py-2.5 text-xs text-muted">
      <FlaskConical size={14} className="text-brand-blue" />
      {loaded ? (
        <span>
          Demo brand <b className="text-ink">Lumora Haircare</b> is loaded (made-up brand, sample comments).
        </span>
      ) : (
        <span>Showing Polarvane to someone? Load a made-up sample brand with ready-analyzed comments.</span>
      )}
      <button
        onClick={() => run(loaded ? "remove" : "load")}
        disabled={pending}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-navy-600 px-3 py-1.5 text-xs text-ink hover:bg-navy-800 disabled:opacity-50"
      >
        {pending && <Loader2 size={12} className="animate-spin" />}
        {loaded ? "Remove demo" : "Load demo brand"}
      </button>
      {msg && <span className="w-full text-amber-200">{msg}</span>}
    </div>
  );
}
