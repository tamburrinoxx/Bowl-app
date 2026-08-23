import Link from "next/link";

export interface NavLink {
  label: string;
  href: string;
}

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Sticky top bar. Links can be page anchors (#payouts) or routes; anchors
 * scroll, routes navigate, so one component covers both.
 */
export function NavBar({
  title,
  links = [],
  backHref,
  crumbs = [],
}: {
  title?: string;
  links?: NavLink[];
  backHref?: string;
  crumbs?: Crumb[];
}) {
  return (
    <div className="sticky top-14 z-40 border-b border-white/10 bg-[#1f2329]/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-2">
        {backHref && (
          <Link
            href={backHref}
            className="text-ink-soft hover:text-ink shrink-0 text-xs"
          >
            ←
          </Link>
        )}

        {crumbs.length > 0 ? (
          <nav className="flex min-w-0 items-center gap-1.5 text-sm">
            {crumbs.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && (
                  <span className="text-ink-soft/40 shrink-0 text-xs">/</span>
                )}
                {c.href ? (
                  <Link
                    href={c.href}
                    className="text-ink-soft hover:text-ink shrink-0 whitespace-nowrap"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-ink truncate font-medium">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : (
          title && (
            <span className="text-ink truncate text-sm font-medium">{title}</span>
          )
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
    </div>
  );
}
