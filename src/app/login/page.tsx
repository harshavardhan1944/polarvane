import { LogoMark } from "@/components/Logo";
import { isSetupMode } from "@/lib/supabase/config";
import { LoginForm } from "./LoginForm";

export const instant = false;

function safeNext(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  // Only allow internal paths, to prevent redirecting users to other sites.
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = safeNext(sp.next);
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <div className="glow-bg flex min-h-screen">
      {/* Brand panel (large screens) */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-navy-700 p-12 lg:flex">
        <div className="brand-gradient pointer-events-none absolute -left-40 bottom-[-12rem] h-[30rem] w-[30rem] rounded-full opacity-25 blur-3xl" />
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-lg font-semibold">Polarvane</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Know what your audience <span className="brand-text">really</span> thinks.
          </h2>
          <p className="mt-4 text-muted">
            AI sentiment and topic analysis for Instagram comments, built for creators, talent
            teams and brands.
          </p>
        </div>
        <p className="relative text-xs text-faint">© Polarvane</p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <span className="text-lg font-semibold">Polarvane</span>
          </div>
          <LoginForm next={next} setupMode={isSetupMode} initialError={error} />
        </div>
      </div>
    </div>
  );
}
