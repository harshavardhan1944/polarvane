// Reads the two PUBLIC Supabase values. These are safe to be seen by browsers;
// data is protected by Row Level Security rules in the database.
// Secret keys (Apify, AI, Supabase service role) must NEVER use the NEXT_PUBLIC_ prefix.

// Clean up common copy-paste mistakes: spaces, quotes, trailing slashes.
function clean(value: string | undefined) {
  return (value ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

const rawUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
const rawKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

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
