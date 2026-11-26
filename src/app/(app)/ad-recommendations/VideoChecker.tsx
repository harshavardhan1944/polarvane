"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Film, Loader2, Quote, TriangleAlert, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { MomentStatus, VideoCheck } from "@/lib/videocheck";
import { checkVideo } from "./actions";

const MAX_MB = 50;
const EXT: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

const STATUS: Record<MomentStatus, { label: string; cls: string }> = {
  doubted: { label: "Customers doubt this", cls: "border-red-400/40 bg-red-400/10 text-red-300" },
  needs_proof: { label: "Needs proof", cls: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  supported: { label: "Customers agree", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
  ok: { label: "Fine", cls: "border-navy-600 text-muted" },
};
const ORDER: MomentStatus[] = ["doubted", "needs_proof", "supported", "ok"];
const plural = (n: number) => `about ${n} comment${n === 1 ? "" : "s"}`;

function Evidence({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {items.map((t) => (
        <li key={t} className="flex gap-1.5 text-xs text-faint">
          <Quote size={11} className="mt-0.5 shrink-0" />
          <span className="italic">{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function VideoChecker({ selected, unit = "post" }: { selected: string[]; unit?: "post" | "thread" }) {
  const [mode, setMode] = useState<"video" | "text">("video");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"" | "uploading" | "checking">("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<VideoCheck | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function pick(f: File | undefined) {
    setError("");
    if (!f) return;
    if (!EXT[f.type]) return setError("Please choose an MP4, MOV or WebM video.");
    if (f.size > MAX_MB * 1024 * 1024) return setError(`The video is over ${MAX_MB} MB. Please use a shorter or smaller file.`);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function run() {
    setError("");
    setResult(null);
    if (selected.length === 0) return setError(`Tick at least one ${unit} above to check against.`);
    if (mode === "video" && !file) return setError("Choose the ad video first.");
    if (mode === "text" && description.trim().length < 15) return setError("Describe the ad in a few sentences.");

    let path: string | undefined;
    try {
      if (mode === "video" && file) {
        setStep("uploading");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Please sign in again.");
        path = `${user.id}/${crypto.randomUUID()}.${EXT[file.type]}`;
        const { error: upErr } = await supabase.storage.from("ad-videos").upload(path, file, { contentType: file.type });
        if (upErr)
          throw new Error(
            /bucket|not found/i.test(upErr.message)
              ? "Video storage isn’t set up yet. Run the 009_ad_videos.sql migration in Supabase."
              : `Upload failed: ${upErr.message}`,
          );
      }
      setStep("checking");
      const res = await checkVideo(selected, { path, description: mode === "text" ? description : undefined, note });
      if (!res.ok) throw new Error(res.message);
      setResult(res.check);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setStep("");
    }
  }

  const busy = step !== "";
  const moments = result ? [...result.moments].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)) : [];

  return (
    <section className="panel space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Film size={18} /> Video ad checker
        </h2>
        <p className="mt-1 text-xs text-faint">
          Before you post an ad, the AI watches it and checks what it says and shows against real comments on the ticked {unit}s (
          {selected.length}).
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-navy-600 p-0.5 text-xs">
        {(["video", "text"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 ${mode === m ? "bg-navy-700 text-ink" : "text-muted hover:text-ink"}`}
          >
            {m === "video" ? "Upload video" : "Describe the ad"}
          </button>
        ))}
      </div>

      {mode === "video" ? (
        <div className="space-y-3">
          <input
            ref={input}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <button
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-navy-600 p-5 text-sm text-muted hover:border-brand-blue/60 hover:text-ink disabled:opacity-50"
          >
            <Upload size={18} />
            {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB (click to change)` : `Choose ad video (MP4/MOV, up to ${MAX_MB} MB, best under 1 minute)`}
          </button>
          {preview && <video src={preview} controls className="max-h-72 rounded-lg border border-navy-700" />}
        </div>
      ) : (
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={3000}
          placeholder="e.g. A girl with oily skin applies the sunscreen in the morning. Text on screen: 'SPF 50, works for every skin type'. She says 'No white cast, no breakouts'. Ends with the bottle and 'Shop now'."
          className="w-full rounded-lg border border-navy-600 bg-navy-900 p-3 text-sm outline-none focus:border-brand-blue/60"
        />
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="Optional note, e.g. “Product: Minimalist SPF 50. Target: oily skin.”"
        className="w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm outline-none focus:border-brand-blue/60"
      />

      <button
        onClick={run}
        disabled={busy}
        className="brand-gradient inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Film size={15} />}
        {step === "uploading" ? "Uploading video…" : step === "checking" ? (mode === "video" ? "AI is watching the ad… (up to 2 min)" : "Checking…") : "Check before posting"}
      </button>
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-300">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <div
            className={`rounded-lg border p-4 ${result.ready ? "border-emerald-400/40 bg-emerald-400/5" : "border-amber-400/40 bg-amber-400/5"}`}
          >
            <p className={`flex items-center gap-2 font-medium ${result.ready ? "text-emerald-300" : "text-amber-200"}`}>
              {result.ready ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}
              {result.ready ? "Ready to test" : "Fix first"}
            </p>
            {result.verdict && <p className="mt-1 text-sm">{result.verdict}</p>}
            {result.summary && <p className="mt-2 text-xs text-muted">What the ad shows: {result.summary}</p>}
            {result.fixes.length > 0 && (
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                {result.fixes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ol>
            )}
            <p className="mt-2 text-[11px] text-faint">
              {result.watched ? "The AI watched the video." : "Checked from your description."} Compared with {result.commentsUsed} comments.
            </p>
          </div>

          <ul className="space-y-3">
            {moments.map((m, i) => (
              <li key={`${m.time}-${i}`} className="rounded-lg border border-navy-700 bg-navy-900 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {m.time && m.time !== "—" && <span className="rounded bg-navy-700 px-1.5 py-0.5 font-mono text-[11px]">{m.time}</span>}
                  <p className="text-sm font-medium">{m.says}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS[m.status].cls}`}>{STATUS[m.status].label}</span>
                  {m.mentions > 0 && <span className="text-xs text-faint">{plural(m.mentions)}</span>}
                </div>
                {m.why && <p className="mt-1 text-xs text-muted">{m.why}</p>}
                {m.suggestion && m.status !== "ok" && (
                  <p className="mt-1 text-xs text-ink">
                    <b>Suggestion:</b> {m.suggestion}
                  </p>
                )}
                <Evidence items={m.evidence} />
              </li>
            ))}
          </ul>

          {result.missing.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Doubts this ad doesn’t answer</h3>
              <ul className="space-y-3">
                {result.missing.map((m) => (
                  <li key={m.text} className="rounded-lg border border-navy-700 bg-navy-900 p-3">
                    <p className="text-sm">
                      {m.text} <span className="text-xs text-faint">· {plural(m.mentions)}</span>
                    </p>
                    <Evidence items={m.evidence} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-faint">
            “Ready to test” means the ad answers what customers doubt. It doesn’t predict sales or confirm claims are true. Your video
            is deleted after the check.
          </p>
        </div>
      )}
    </section>
  );
}
