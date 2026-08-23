"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";

const SECTIONS = [
  { group: "Host", links: [
    { label: "My tournaments", href: "/host/tournaments" },
    { label: "Build a tournament", href: "/host/tournaments/wizard" },
    { label: "Manual setup", href: "/host/tournaments/new" },
  ]},
  { group: "Bowler", links: [
    { label: "Public tournaments", href: "/t" },
    { label: "My profile", href: "/profile" },
    { label: "Practice scoring", href: "/profile/score" },
  ]},
];

const QUICK = [
  { label: "Tournaments", href: "/host/tournaments" },
  { label: "New", href: "/host/tournaments/wizard" },
  { label: "Public", href: "/t" },
  { label: "Profile", href: "/profile" },
];

export default function AppNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/login") return null;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1f2329]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-6">
          <Link href="/host/tournaments" className="shrink-0">
            <Logo className="text-lg" />
          </Link>

          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {QUICK.map((l) => {
              const active =
                l.href === "/t" ? pathname === "/t" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-accent/15 text-accent"
                      : "text-ink-soft hover:text-ink hover:bg-white/8"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="text-ink-soft hover:text-ink ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/8 sm:ml-0"
          >
            <span className="flex flex-col gap-[3px]">
              <span className="block h-[2px] w-4 bg-current" />
              <span className="block h-[2px] w-4 bg-current" />
              <span className="block h-[2px] w-4 bg-current" />
            </span>
          </button>
        </div>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="ml-auto h-full w-72 max-w-[85vw] overflow-y-auto border-l border-white/10 bg-[#1f2329] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <Logo className="text-lg" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-ink-soft hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>

            {SECTIONS.map((s) => (
              <div key={s.group} className="mb-6">
                <p className="text-ink-soft mb-2 text-xs font-medium uppercase tracking-wide">
                  {s.group}
                </p>
                <div className="space-y-1">
                  {s.links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="text-ink hover:bg-white/8 block rounded-xl px-3 py-2 text-sm"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
