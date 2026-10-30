"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

function friendlyError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — check your inbox.";
  if (m.includes("already registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("password")) return message;
  if (m.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("fetch")) return "Can’t reach the login service. Check your internet connection.";
  return message;
}

export function LoginForm({
  next,
  setupMode,
  initialError,
}: {
  next: string;
  setupMode: boolean;
  initialError: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    initialError === "service"
      ? "We couldn’t reach the login service. Please try again in a moment."
      : initialError
        ? "That sign-in link didn’t work. Please try again."
        : null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (setupMode) return setError("Login isn’t connected yet (setup mode).");

    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setNotice(`We sent a confirmation link to ${email}. Click it, then come back and sign in.`);
          setMode("signin");
          setPassword("");
        }
      }
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  const isSignIn = mode === "signin";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {isSignIn ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        {isSignIn ? "Sign in to your Polarvane workspace." : "Start analyzing your audience in minutes."}
      </p>

      {setupMode && (
        <p className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
          Setup mode: login isn’t connected to Supabase yet, so sign-in is disabled.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <label className="block">
          <span className="text-xs font-medium text-muted">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="mt-1.5 w-full rounded-lg border border-navy-700 bg-navy-850 px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/25"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Password</span>
          <input
            type="password"
            autoComplete={isSignIn ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignIn ? "Your password" : "At least 8 characters"}
            className="mt-1.5 w-full rounded-lg border border-navy-700 bg-navy-850 px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/25"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-negative/30 bg-negative/10 p-3 text-sm text-red-200">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg border border-positive/30 bg-positive/10 p-3 text-sm text-emerald-200">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="brand-gradient flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white shadow-lg shadow-brand-violet/20 hover:opacity-95 disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {isSignIn ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isSignIn ? "New to Polarvane?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(isSignIn ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="font-medium text-brand-blue hover:underline"
        >
          {isSignIn ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
