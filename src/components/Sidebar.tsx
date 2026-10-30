"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Link2,
  MessageSquareText,
  Sparkles,
  Plug,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "./Logo";

const NAV_GROUPS = [
  {
    label: "Insights",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/copilot", label: "Talon copilot", icon: Sparkles },
      { href: "/comments", label: "Comments", icon: MessageSquareText },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/analyze", label: "Analyze a post", icon: Link2 },
      { href: "/integrations", label: "Integrations", icon: Plug },
    ],
  },
];

export function Sidebar({ footer }: { footer: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-6">
      {NAV_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 px-3 text-xs text-faint">{g.label}</p>
          <div className="flex flex-col gap-0.5">
            {g.items.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-navy-800 text-ink" : "text-muted hover:bg-navy-850 hover:text-ink"
                  }`}
                >
                  {active && <span className="brand-gradient absolute -left-4 top-1.5 bottom-1.5 w-[3px] rounded-r-full" />}
                  <Icon size={16} className={active ? "text-brand-blue" : "text-faint group-hover:text-muted"} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-navy-700 bg-navy-900/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-muted hover:bg-navy-800"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-navy-700 bg-navy-900 p-4">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-muted hover:bg-navy-800"
              >
                <X size={20} />
              </button>
            </div>
            {nav}
            <div className="mt-auto">{footer}</div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-navy-700 bg-navy-950/70 p-4 backdrop-blur lg:flex">
        <div className="mb-9 px-2 pt-1">
          <Logo />
        </div>
        {nav}
        <div className="mt-auto">{footer}</div>
      </aside>
    </>
  );
}
