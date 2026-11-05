"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { createDashboard, deleteDashboard } from "@/app/(app)/dashboards/actions";

export function DashboardSwitcher({
  dashboards,
  current,
  basePath = "/",
  allLabel = "All posts",
}: {
  dashboards: { id: string; name: string }[] | null;
  current: string;
  basePath?: string;
  allLabel?: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  if (dashboards === null) {
    return (
      <p className="mb-6 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
        Named dashboards need the database update (part 5) in Supabase.
      </p>
    );
  }

  const href = (id: string) => (id ? `${basePath}?d=${id}` : basePath);

  function create() {
    setError(null);
    startTransition(async () => {
      const r = await createDashboard(name);
      if (!r.ok) return setError(r.message);
      setCreating(false);
      setName("");
      router.push(href(r.id));
    });
  }

  return (
    <div className="mb-6">
      <nav className="flex flex-wrap items-center gap-1.5" aria-label="Dashboards">
        {[{ id: "", name: allLabel }, ...dashboards].map((d) => (
          <Link
            key={d.id || "all"}
            href={href(d.id)}
            aria-current={current === d.id ? "page" : undefined}
            className={`max-w-[16rem] truncate rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              current === d.id
                ? "border-brand-blue/60 bg-brand-blue/15 text-ink"
                : "border-navy-600 bg-navy-900/50 text-muted hover:text-ink"
            }`}
          >
            {d.name}
          </Link>
        ))}

        {creating ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
            className="flex items-center gap-1.5"
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Dashboard name"
              aria-label="New dashboard name"
              className="w-52 rounded-full border border-brand-blue/60 bg-navy-900 px-3.5 py-1.5 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="brand-gradient inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending && <Loader2 size={13} className="animate-spin" />} Create
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              aria-label="Cancel"
              className="rounded-full p-1.5 text-faint hover:text-ink"
            >
              <X size={15} />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-navy-600 px-3.5 py-1.5 text-sm text-muted hover:border-brand-blue/60 hover:text-ink"
          >
            <Plus size={14} /> New dashboard
          </button>
        )}

        {current &&
          (confirmDelete ? (
            <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted">
              Delete this dashboard? Its posts are kept.
              <button
                onClick={() =>
                  startTransition(async () => {
                    await deleteDashboard(current);
                    setConfirmDelete(false);
                    router.push(basePath);
                  })
                }
                className="rounded-md border border-negative/40 px-2 py-1 text-red-200 hover:bg-negative/10"
              >
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-1 hover:text-ink">
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete this dashboard"
              aria-label="Delete this dashboard"
              className="ml-auto rounded-md p-1.5 text-faint hover:text-red-300"
            >
              <Trash2 size={14} />
            </button>
          ))}
      </nav>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
