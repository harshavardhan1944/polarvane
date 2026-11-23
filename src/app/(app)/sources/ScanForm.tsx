"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Loader2, Radar } from "lucide-react";
import { startScan, type ScanState } from "./actions";

const STEPS = [
  "Checking Google Play and the App Store…",
  "Searching Reddit and the news…",
  "Reading YouTube comments…",
  "Counting Amazon ratings…",
  "Reading Google reviews for every location…",
  "Ranking where customers talk most…",
];

export function ScanForm({ paidAvailable }: { paidAvailable: boolean }) {
  const [state, action, pending] = useActionState<ScanState, FormData>(startScan, { status: "idle" });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => {
      clearInterval(t);
      setStep(0);
    };
  }, [pending]);

  const input =
    "w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/25";

  return (
    <div className="panel p-5 sm:p-6">
      <form action={action} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_auto]">
          <input name="brand" required minLength={2} maxLength={80} placeholder="Brand, e.g. boAt, Mamaearth, Third Wave Coffee" aria-label="Brand name" className={input} autoComplete="off" />
          <input name="market" maxLength={60} placeholder="Market (optional), e.g. India, Bengaluru" aria-label="Market" className={input} autoComplete="off" />
          <button
            type="submit"
            disabled={pending}
            className="brand-gradient inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-brand-violet/20 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />}
            {pending ? "Scanning…" : "Find sources"}
          </button>
        </div>
        <label className="flex items-start gap-2 text-xs text-muted">
          <input type="checkbox" name="paid" defaultChecked={paidAvailable} disabled={!paidAvailable || pending} className="mt-0.5 accent-[#5b8cff]" />
          <span>
            Include Amazon and Google reviews (uses Apify credit, capped at about $0.40 per scan).
            {!paidAvailable && " Needs APIFY_TOKEN in Vercel."}
          </span>
        </label>
      </form>

      {pending && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-brand-blue/30 bg-brand-blue/10 p-3 text-sm text-blue-200">
          <Loader2 size={15} className="animate-spin" /> {STEPS[step]} This usually takes 30–120 seconds.
        </p>
      )}
      {!pending && state.status === "error" && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-negative/30 bg-negative/10 p-3 text-sm text-red-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {state.message}
        </p>
      )}
    </div>
  );
}
