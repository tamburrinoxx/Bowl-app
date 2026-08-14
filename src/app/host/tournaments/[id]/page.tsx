import { createClient } from "@/lib/supabase/server";
import type { Entry, StandingsRow, Tournament } from "@/types";
import ScoreEntryPanel from "./score-entry-panel";
import VerifyBadge from "./verify-badge";

export default async function HostTournamentPage({
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

  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .eq("tournament_id", id)
    .returns<Entry[]>();

  const { data: standings } = await supabase
    .from("standings")
    .select("*")
    .eq("tournament_id", id)
    .order("handicap_total", { ascending: false })
    .returns<StandingsRow[]>();

  if (!tournament) {
    return (
      <main className="min-h-screen bg-walnut text-chalk flex items-center justify-center">
        <p className="font-score">Tournament not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-walnut text-chalk px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-baseline justify-between border-b border-walnut-mid pb-6 mb-8">
          <div>
            <p className="font-score text-scoreboard-amber text-sm mb-1">
              {tournament.center_name?.toUpperCase() ?? "HOST DASHBOARD"}
            </p>
            <h1 className="font-display text-4xl md:text-5xl">{tournament.name}</h1>
          </div>
          <span className="font-score text-xs uppercase border border-walnut-mid rounded-full px-3 py-1">
            {tournament.status.replace("_", " ")}
          </span>
        </div>

        <section className="mb-10">
          <h2 className="font-display text-xl text-scoreboard-amber mb-3">Entries</h2>
          <div className="space-y-2">
            {entries?.length ? (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between border border-walnut-mid rounded-md px-4 py-3"
                >
                  <div>
                    <p className="font-body">{entry.entry_name}</p>
                    <p className="font-score text-xs text-chalk/50">
                      avg {entry.locked_average ?? "—"} · hdcp {entry.locked_handicap ?? "—"}
                    </p>
                  </div>
                  <VerifyBadge entryId={entry.id} status={entry.verification_status} />
                </div>
              ))
            ) : (
              <p className="text-chalk/50 font-score text-sm">
                No entries yet. Bowlers sign up, or add them manually below.
              </p>
            )}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="font-display text-xl text-scoreboard-amber mb-3">Enter Scores</h2>
          <ScoreEntryPanel
            entries={entries ?? []}
            gamesPerSquad={tournament.games_per_squad}
          />
        </section>

        <section>
          <h2 className="font-display text-xl text-scoreboard-amber mb-3">Standings</h2>
          <div className="overflow-x-auto border border-walnut-mid rounded-md">
            <table className="w-full font-score text-sm">
              <thead>
                <tr className="text-left text-chalk/50 uppercase text-xs">
                  <th className="scoresheet-cell px-3 py-2">Pos</th>
                  <th className="scoresheet-cell px-3 py-2">Entry</th>
                  <th className="scoresheet-cell px-3 py-2 text-right">Games</th>
                  <th className="scoresheet-cell px-3 py-2 text-right">Scratch</th>
                  <th className="scoresheet-cell px-3 py-2 text-right">Hdcp</th>
                  <th className="scoresheet-cell px-3 py-2 text-right text-scoreboard-amber">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {standings?.map((row, i) => (
                  <tr key={row.entry_id}>
                    <td className="scoresheet-cell px-3 py-2">{i + 1}</td>
                    <td className="scoresheet-cell px-3 py-2 font-body">{row.entry_name}</td>
                    <td className="scoresheet-cell px-3 py-2 text-right">{row.games_played}</td>
                    <td className="scoresheet-cell px-3 py-2 text-right">{row.scratch_total}</td>
                    <td className="scoresheet-cell px-3 py-2 text-right">
                      {row.locked_handicap ?? 0}
                    </td>
                    <td className="scoresheet-cell px-3 py-2 text-right text-scoreboard-amber font-bold">
                      {row.handicap_total}
                    </td>
                  </tr>
                ))}
                {!standings?.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-chalk/40">
                      No games posted yet.
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
