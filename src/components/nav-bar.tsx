import Link from "next/link";
import { Logo } from "@/components/logo";

export interface NavLink {
  label: string;
  href: string;
}

/**
 * Sticky top bar. Links can be page anchors (#payouts) or routes; anchors
 * scroll, routes navigate, so one component covers both.
 */
export function NavBar({
  title,
  links = [],
  backHref,
}: {
  title?: string;
  links?: NavLink[];
  backHref?: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1f2329]/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3">
        <Link href={backHref ?? "/"} className="shrink-0">
          <Logo className="text-lg" />
        </Link>

        {title && (
          <span className="text-ink-soft hidden truncate text-sm sm:inline">
            {title}
          </span>
        )}

        {links.length > 0 && (
          <nav className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-ink-soft hover:text-ink hover:bg-white/8 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
