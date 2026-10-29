"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function UserMenu({ email, setupMode }: { email: string | null; setupMode: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const initial = (email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="rounded-xl border border-navy-700 bg-navy-850 p-3">
      <div className="flex items-center gap-3">
        <div className="brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{email ?? "Preview user"}</p>
          <p className="text-xs text-faint">{setupMode ? "Setup mode" : "Signed in"}</p>
        </div>
        {!setupMode && (
          <button
            onClick={signOut}
            disabled={busy}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-1.5 text-muted hover:bg-navy-700 hover:text-ink disabled:opacity-50"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
