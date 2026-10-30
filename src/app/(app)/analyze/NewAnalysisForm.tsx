"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, Link2 } from "lucide-react";
import { parseInstagramUrl } from "@/lib/instagram";
import { createAnalysis, type CreateAnalysisState } from "./actions";

export function NewAnalysisForm() {
  const [state, action, pending] = useActionState<CreateAnalysisState, FormData>(createAnalysis, {
    status: "idle",
  });
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Instant feedback while typing (the server checks again on submit).
  const live = url.trim() ? parseInstagramUrl(url) : null;
  const liveError = touched && live && !live.ok ? live.error : null;

  // Clear the box after a successful save (adjusting state during render).
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state.status === "created") {
      setUrl("");
      setTouched(false);
    }
  }

  return (
    <div className="panel p-5 sm:p-6">
      <form
        ref={formRef}
        action={action}
        onSubmit={() => setTouched(true)}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Link2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            name="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="https://www.instagram.com/p/… or /reel/…"
            autoComplete="off"
            aria-label="Instagram post or Reel link"
            className="w-full rounded-lg border border-navy-700 bg-navy-900 py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-faint focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/25"
          />
        </div>
        <button
          type="submit"
          disabled={pending || !url.trim() || (live !== null && !live.ok)}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-brand-violet/20 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && <Loader2 size={15} className="animate-spin" />}
          Add post
        </button>
      </form>

      {live?.ok && !pending && state.status !== "created" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300">
          <CheckCircle2 size={13} /> Valid Instagram {live.postType === "reel" ? "Reel" : "post"} link
        </p>
      )}
      {liveError && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-red-300">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {liveError}
        </p>
      )}

      {!pending && state.status === "error" && (
        <Message tone="error">{state.message}</Message>
      )}
      {!pending && state.status === "duplicate" && <Message tone="info">{state.message}</Message>}
      {!pending && state.status === "created" && <Message tone="success">{state.message}</Message>}

      <p className="mt-4 text-xs leading-relaxed text-faint">
        Works with public posts and Reels only. Tip: in Instagram, tap <b>Share → Copy link</b>. AI analysis
        currently uses Google Gemini’s free plan, under which Google may use submitted comments to improve its
        products.
      </p>
    </div>
  );
}

function Message({ tone, children }: { tone: "error" | "info" | "success"; children: React.ReactNode }) {
  const styles = {
    error: "border-negative/30 bg-negative/10 text-red-200",
    info: "border-brand-blue/30 bg-brand-blue/10 text-blue-200",
    success: "border-positive/30 bg-positive/10 text-emerald-200",
  }[tone];
  const Icon = tone === "error" ? AlertCircle : tone === "info" ? Info : CheckCircle2;
  return (
    <p role="status" className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-sm ${styles}`}>
      <Icon size={16} className="mt-0.5 shrink-0" /> {children}
    </p>
  );
}
