// Reads the two PUBLIC Supabase values. These are safe to be seen by browsers;
// data is protected by Row Level Security rules in the database.
// Secret keys (Apify, AI, Supabase service role) must NEVER use the NEXT_PUBLIC_ prefix.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// "Setup mode" lets us preview screens before Supabase is connected.
// It is only ever allowed on a developer machine, never on the live site.
export const isSetupMode =
  !isSupabaseConfigured && process.env.NODE_ENV !== "production";
