import { LogoMark } from "@/components/Logo";

export default function SetupRequiredPage() {
  return (
    <div className="glow-bg flex min-h-screen items-center justify-center p-6">
      <div className="panel max-w-md p-8 text-center">
        <div className="flex justify-center"><LogoMark size={40} /></div>
        <h1 className="mt-4 text-lg font-semibold">Polarvane isn’t configured yet</h1>
        <p className="mt-2 text-sm text-muted">
          The site owner needs to add the Supabase settings before anyone can sign in.
        </p>
      </div>
    </div>
  );
}
