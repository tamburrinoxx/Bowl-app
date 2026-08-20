import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { StandingsRow, Tournament } from "@/types";

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single<Tournament>();

  const { data: standings } = await supabase
    .from("standings")
    .select("*")
    .eq("tournament_id", id)
    .order("handicap_total", { ascending: false })
    .returns<StandingsRow[]>();

  if (!tournament) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-ink-soft">Tournament not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/t" className="text-accent text-sm font-medium mb-6 inline-block">
          ← All Tournaments
        </Link>

        <div className="glass-panel p-8 mb-6 flex items-baseline justify-between">
          <div>
            <p className="font-score text-accent text-xs font-semibold tracking-wide mb-1 uppercase">
              {tournament.center_name ?? "Live Standings"}
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink">{tournament.name}</h1>
            {tournament.starts_at && (
              <p className="text-ink-soft text-sm mt-1">
                {new Date(tournament.starts_at).toLocaleString()}
              </p>
            )}
          </div>
          <span className="text-xs font-semibold uppercase rounded-full bg-white/8 px-4 py-1.5 text-ink-soft shrink-0 ml-4">
            {tournament.status.replace("_", " ")}
          </span>
        </div>

        <section className="glass-panel p-8">
          <h2 className="font-display text-xl text-ink mb-4">Standings</h2>
          <div className="overflow-x-auto rounded-2xl bg-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft uppercase text-xs">
                  <th className="px-4 py-3">Pos</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3 text-right">Games</th>
                  <th className="px-4 py-3 text-right">Scratch</th>
                  <th className="px-4 py-3 text-right">Hdcp</th>
                  <th className="px-4 py-3 text-right text-accent">Total</th>
                </tr>
              </thead>
              <tbody>
                {standings?.map((row, i) => (
                  <tr key={row.entry_id} className="border-t border-white/10">
                    <td className="px-4 py-3 text-ink">{i + 1}</td>
                    <td className="px-4 py-3 text-ink font-medium">
                      {row.entry_name}
                      {row.verification_status === "flagged" && (
                        <span className="ml-2 text-warning text-xs font-semibold uppercase">
                          Flagged
                        </span>
                      )}
                      {row.verification_status === "pending" && (
                        <span className="ml-2 text-ink-soft text-xs font-semibold uppercase">
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-score text-ink">
                      {row.games_played}
                    </td>
                    <td className="px-4 py-3 text-right font-score text-ink">
                      {row.scratch_total}
                    </td>
                    <td className="px-4 py-3 text-right font-score text-ink">
                      {row.locked_handicap ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right font-score text-accent font-bold">
                      {row.handicap_total}
                    </td>
                  </tr>
                ))}
                {!standings?.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-ink-soft">
                      No entries yet. Check back once bowlers are signed up.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
