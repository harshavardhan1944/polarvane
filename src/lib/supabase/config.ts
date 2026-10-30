// Reads the two PUBLIC Supabase values. These are safe to be seen by browsers;
// data is protected by Row Level Security rules in the database.
// Secret keys (Apify, AI, Supabase service role) must NEVER use the NEXT_PUBLIC_ prefix.

// Polarvane's own Supabase project. Both values are PUBLIC by design (every
// visitor's browser receives them), so keeping them in code is safe. Hosting
// settings can override them, but a mistyped setting falls back to these.
const DEFAULT_URL = "https://zxzrtjhzckxgwzyphahg.supabase.co";
const DEFAULT_KEY = "sb_publishable_FHw2BuZgU68r5GTPyFZ6SQ_zceQhOZH";

// Clean up copy-paste mistakes: spaces, quotes, invisible characters,
// or "KEY=value" pasted into the value box.
function clean(value: string | undefined) {
  return (value ?? "")
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .replace(/^[A-Z_]+=/, "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

function pickUrl(value: string | undefined) {
  const match = clean(value).match(/https?:\/\/[^\s"'<>]+/);
  const url = match ? match[0].replace(/\/+$/, "") : "";
  return isValidUrl(url) ? url : DEFAULT_URL;
}

const rawUrl = pickUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const rawKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || DEFAULT_KEY;

function isValidUrl(u: string) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// Human-readable list of what is wrong (never includes the values themselves).
export const configProblems: string[] = [];
if (!rawUrl) configProblems.push("NEXT_PUBLIC_SUPABASE_URL is missing.");
else if (!isValidUrl(rawUrl))
  configProblems.push(
    "NEXT_PUBLIC_SUPABASE_URL is not a valid web address. It should look like https://xxxx.supabase.co",
  );
if (!rawKey) configProblems.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.");

export const isSupabaseConfigured = configProblems.length === 0;
export const supabaseUrl = isSupabaseConfigured ? rawUrl : "";
export const supabaseAnonKey = isSupabaseConfigured ? rawKey : "";

// "Setup mode" lets us preview screens before Supabase is connected.
// It is only ever allowed on a developer machine, never on the live site.
export const isSetupMode =
  !isSupabaseConfigured && process.env.NODE_ENV !== "production";
