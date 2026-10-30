import { LogoMark } from "@/components/Logo";
import { configProblems } from "@/lib/supabase/config";

export default function SetupRequiredPage() {
  return (
    <div className="glow-bg flex min-h-screen items-center justify-center p-6">
      <div className="panel max-w-md p-8 text-center">
        <div className="flex justify-center">
          <LogoMark size={40} />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Polarvane isn’t configured yet</h1>
        <p className="mt-2 text-sm text-muted">
          The site owner needs to fix the Supabase settings before anyone can sign in.
        </p>
        {configProblems.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-left text-xs text-amber-200">
            {configProblems.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
