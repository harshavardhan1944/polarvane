import { Construction } from "lucide-react";

// Honest placeholder for features that are planned but not built yet.
export function NotBuiltYet({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="panel flex flex-col items-start gap-3 p-6 sm:p-8">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300">
        <Construction size={13} /> Not built yet · planned for step {step}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-xl text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl leading-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}
