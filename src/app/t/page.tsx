import { Logo } from "@/components/logo";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Tournament } from "@/types";

export const dynamic = "force-dynamic";

export default async function PublicTournamentsPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const sp = await searchParams;
  const stateFilter = sp.state ?? "";
  const supabase = await createClient();

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("*")
    .order("starts_at", { ascending: true, nullsFirst: false })
    .returns<Tournament[]>();

  const rows = (tournaments ?? []) as (Tournament & { city?: string | null; state?: string | null })[];
  const states = Array.from(new Set(rows.map((t) => t.state).filter((s): s is string => Boolean(s)))).sort();
  const shown = stateFilter ? rows.filter((t) => t.state === stateFilter) : rows;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Logo className="mb-3 text-2xl" />
        <h1 className="font-display text-2xl sm:text-4xl text-ink mb-3 sm:mb-4">Tournaments</h1>

        <form method="get" className="mb-5 sm:mb-8 flex items-center gap-2">
          <select name="state" defaultValue={stateFilter} className="glass-panel px-3 py-2 text-sm text-ink bg-transparent">
            <option value="">All states</option>
            {states.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <button type="submit" className="text-xs uppercase tracking-wide border border-white/15 rounded-full px-4 py-2 text-ink-soft hover:text-ink">Filter</button>
        </form>

        {shown.length ? (
          <div className="space-y-2 sm:space-y-3">
            {shown.map((t) => (
              <Link
                key={t.id}
                href={`/t/${t.id}`}
                className="glass-panel p-4 sm:p-6 flex items-center justify-between hover:bg-white/8 transition-colors block"
              >
                <div>
                  <p className="font-display text-lg sm:text-xl text-ink mb-0.5">{t.name}</p>
                  <p className="text-ink-soft text-sm">
                    {t.center_name ?? "Center TBD"}
                {(t.city || t.state) ? ` · ${[t.city, t.state].filter(Boolean).join(", ")}` : ""}
                    {t.starts_at
                      ? ` · ${new Date(t.starts_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold uppercase rounded-full px-3 py-1 shrink-0 ml-3 ${
                    t.status === "in_progress"
                      ? "bg-accent/15 text-accent"
                      : "bg-white/8 text-ink-soft"
                  }`}
                >
                  {t.status.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-ink-soft text-sm glass-panel p-6">
            No tournaments have been created yet.
          </p>
        )}
      </div>
    </main>
  );
}
