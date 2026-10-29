import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { UserMenu } from "@/components/UserMenu";
import { isSetupMode } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

// Every app page depends on who is signed in, so render per request.
export const instant = false;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let email: string | null = null;

  if (!isSetupMode) {
    // Server-side check: never trust the browser alone.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    email = user.email ?? null;
  }

  return (
    <div className="glow-bg flex min-h-screen flex-col lg:flex-row">
      <Sidebar footer={<UserMenu email={email} setupMode={isSetupMode} />} />
      <main className="min-w-0 flex-1">
        {isSetupMode && (
          <div className="border-b border-amber-400/20 bg-amber-400/10 px-6 py-2 text-xs text-amber-200">
            Setup mode: login is not connected yet, so this preview is open. It only works on a
            developer machine — the live site always requires sign-in.
          </div>
        )}
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
