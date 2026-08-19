import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Tournament } from "@/types";

export default async function PublicTournamentsPage() {
  const supabase = await createClient();

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("*")
    .order("starts_at", { ascending: true, nullsFirst: false })
    .returns<Tournament[]>();

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <p className="font-score text-accent text-xs font-semibold tracking-wide mb-2 uppercase">
          Bowl
        </p>
        <h1 className="font-display text-4xl text-ink mb-8">Tournaments</h1>

        {tournaments?.length ? (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/t/${t.id}`}
                className="glass-panel p-6 flex items-center justify-between hover:bg-white/8 transition-colors block"
              >
                <div>
                  <p className="font-display text-xl text-ink mb-1">{t.name}</p>
                  <p className="text-ink-soft text-sm">
                    {t.center_name ?? "Center TBD"}
                    {t.starts_at
                      ? ` · ${new Date(t.starts_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold uppercase rounded-full px-4 py-1.5 shrink-0 ml-4 ${
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
