"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Clapperboard,
  Download,
  ExternalLink,
  ImageIcon,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { COMMENT_LIMITS, estimateApifyCost } from "@/lib/pricing";
import { checkCollection, deleteAnalysis, startCollection } from "./actions";

export type AnalysisRowData = {
  id: string;
  post_url: string;
  shortcode: string;
  post_type: "post" | "reel";
  status: "queued" | "collecting" | "analyzing" | "completed" | "failed";
  error_message: string | null;
  comments_collected: number;
  comment_limit: number;
  created_at: string;
  created_label: string;
};

const BADGE: Record<AnalysisRowData["status"], { label: string; cls: string }> = {
  queued: { label: "Ready to collect", cls: "border-navy-600 bg-navy-800 text-muted" },
  collecting: { label: "Collecting comments", cls: "border-brand-blue/30 bg-brand-blue/10 text-blue-200" },
  analyzing: { label: "Collected · AI analysis not built yet", cls: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
  completed: { label: "Completed", cls: "border-positive/30 bg-positive/10 text-emerald-200" },
  failed: { label: "Failed", cls: "border-negative/30 bg-negative/10 text-red-200" },
};

export function AnalysisRow({ row }: { row: AnalysisRowData }) {
  const router = useRouter();
  const [limit, setLimit] = useState<number>(200);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [elapsed, setElapsed] = useState(0);
  const checking = useRef(false);

  // While collecting, ask the server every 5 seconds whether Apify has finished.
  useEffect(() => {
    if (row.status !== "collecting") return;
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    const poll = setInterval(async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const res = await checkCollection(row.id);
        if (!res.ok) setMessage(res.message);
        else if (res.status !== "collecting") router.refresh();
        else setMessage(res.message ?? null);
      } catch {
        setMessage("Lost connection while checking. Retrying…");
      } finally {
        checking.current = false;
      }
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [row.status, row.id, router]);

  function start() {
    setMessage(null);
    startTransition(async () => {
      const res = await startCollection(row.id, limit);
      if (!res.ok) setMessage(res.message);
      setConfirming(false);
      router.refresh();
    });
  }

  const badge = BADGE[row.status];
  const Icon = row.post_type === "reel" ? Clapperboard : ImageIcon;
  const canStart = row.status === "queued" || row.status === "failed";

  return (
    <div className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-700/70">
            <Icon size={16} className="text-brand-blue" />
          </div>
          <div className="min-w-0">
            <a
              href={row.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 truncate text-sm hover:text-brand-blue"
            >
              {row.post_type === "reel" ? "Reel" : "Post"} · {row.shortcode}
              <ExternalLink size={12} className="shrink-0 text-faint" />
            </a>
            <p className="text-xs text-faint">
              Added {row.created_label}
              {row.comments_collected > 0 && ` · ${row.comments_collected.toLocaleString()} comments collected`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${badge.cls}`}>
            {row.status === "collecting" && <Loader2 size={12} className="animate-spin" />}
            {badge.label}
          </span>
          <form action={deleteAnalysis}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              disabled={row.status === "collecting"}
              title={row.status === "collecting" ? "Wait for collection to finish" : "Remove"}
              aria-label="Remove this post"
              className="rounded-md p-1.5 text-faint hover:bg-navy-700 hover:text-red-300 disabled:opacity-30"
            >
              <Trash2 size={15} />
            </button>
          </form>
        </div>
      </div>

      {row.status === "failed" && row.error_message && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-negative/30 bg-negative/10 p-3 text-xs text-red-200">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {row.error_message}
        </p>
      )}

      {row.status === "collecting" && (
        <p className="mt-3 text-xs text-muted">
          Apify is reading the comments. This usually takes 1–3 minutes ({elapsed}s so far). You can leave this
          page and come back.
        </p>
      )}

      {canStart && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-navy-700 bg-navy-900/60 p-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-xs text-muted">
            Collect up to
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setConfirming(false);
              }}
              disabled={pending}
              className="rounded-md border border-navy-700 bg-navy-850 px-2 py-1 text-xs text-ink outline-none focus:border-brand-blue"
            >
              {COMMENT_LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()} comments
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-faint">Estimated Apify cost: about {estimateApifyCost(limit)}</span>
          <div className="flex gap-2 sm:ml-auto">
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                disabled={pending}
                className="brand-gradient inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {row.status === "failed" ? <RotateCcw size={13} /> : <Download size={13} />}
                {row.status === "failed" ? "Try again" : "Collect comments"}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="rounded-md border border-navy-600 px-3 py-1.5 text-xs text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={start}
                  disabled={pending}
                  className="brand-gradient inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {pending && <Loader2 size={13} className="animate-spin" />}
                  Confirm · up to {estimateApifyCost(limit).split("–")[1]}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {message && message !== row.error_message && (
        <p className="mt-3 flex items-start gap-2 text-xs text-amber-200">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {message}
        </p>
      )}
    </div>
  );
}
