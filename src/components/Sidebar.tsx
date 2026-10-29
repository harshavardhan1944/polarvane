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

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analyze", label: "New analysis", icon: Link2 },
  { href: "/comments", label: "Comments", icon: MessageSquareText },
  { href: "/copilot", label: "Talon Copilot", icon: Sparkles },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

export function Sidebar({ footer }: { footer: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-navy-700/70 text-ink"
                : "text-muted hover:bg-navy-800 hover:text-ink"
            }`}
          >
            <Icon
              size={17}
              className={active ? "text-brand-blue" : "text-faint group-hover:text-muted"}
            />
            {label}
          </Link>
        );
      })}
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
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-navy-700 bg-navy-900/80 p-4 lg:flex">
        <div className="mb-8 px-2 pt-1">
          <Logo />
        </div>
        <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-faint">
          Workspace
        </p>
        {nav}
        <div className="mt-auto">{footer}</div>
      </aside>
    </>
  );
}
