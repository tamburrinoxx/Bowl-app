import { createClient } from "@/lib/supabase/server";
import type { Entry, StandingsRow, Tournament } from "@/types";
import { Fragment } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/payouts";
import AddEntryPanel from "./add-entry-panel";
import PayoutsPanel from "./payouts-panel";
import SidePotsPanel from "./side-pots-panel";
import ScoreEntryPanel from "./score-entry-panel";
import StatusSwitch from "./status-switch";
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

  const { data: payouts } = await supabase
    .from("tournament_payouts")
    .select("position, amount")
    .eq("tournament_id", id)
    .order("position");

  const paidSpots = payouts?.length ?? 0;
  const payoutFor = new Map(
    (payouts ?? []).map((p) => [p.position, Number(p.amount)]),
  );

  if (!tournament) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-ink-soft">Tournament not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/host/tournaments"
          className="text-accent mb-4 inline-block text-sm hover:brightness-110"
        >
          ← Your tournaments
        </Link>
        <div className="glass-panel p-8 mb-6 flex items-baseline justify-between">
          <div>
            <p className="font-score text-accent text-xs font-semibold tracking-wide mb-1 uppercase">
              {tournament.center_name ?? "Host Dashboard"}
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink">{tournament.name}</h1>
          </div>
          <span className="text-xs font-semibold uppercase rounded-full bg-white/8 px-4 py-1.5 text-ink-soft">
            {tournament.status.replace("_", " ")}
          </span>
        </div>

        <Link
          href={`/t/${tournament.id}`}
          target="_blank"
          className="glass-panel p-4 mb-6 flex items-center justify-between hover:bg-white/8 transition-colors"
        >
          <p className="text-ink-soft text-sm">
            Public live-standings page — share this link with bowlers
          </p>
          <span className="text-accent text-sm font-medium shrink-0 ml-4">Open →</span>
        </Link>

        <section className="glass-panel p-8 mb-6">
          <h2 className="font-display text-xl text-ink mb-4">Status</h2>
          <StatusSwitch tournamentId={tournament.id} status={tournament.status} />
        </section>

        <section className="glass-panel p-8 mb-6">
          <h2 className="font-display text-xl text-ink mb-4">Entries</h2>
          <div className="space-y-3">
            {entries?.length ? (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-2xl bg-white/5 px-5 py-4"
                >
                  <div>
                    <p className="text-ink font-medium">{entry.entry_name}</p>
                    <p className="text-ink-soft text-xs mt-0.5">
                      avg {entry.locked_average ?? "—"} · hdcp {entry.locked_handicap ?? "—"}
                    </p>
                  </div>
                  <VerifyBadge entryId={entry.id} status={entry.verification_status} />
                </div>
              ))
            ) : (
              <p className="text-ink-soft text-sm rounded-2xl bg-white/5 p-5">
                No entries yet — add one below.
              </p>
            )}
          </div>
        </section>

        <section className="glass-panel p-8 mb-6">
          <h2 className="font-display text-xl text-ink mb-4">Add Entry</h2>
          <AddEntryPanel
            tournamentId={tournament.id}
            eventType={tournament.event_type}
            handicapBase={tournament.handicap_base}
            handicapPercent={tournament.handicap_percent}
          />
        </section>

        <section className="glass-panel p-8 mb-6">
          <h2 className="font-display text-xl text-ink mb-4">Enter Scores</h2>
          <ScoreEntryPanel
            entries={entries ?? []}
            gamesPerSquad={tournament.games_per_squad}
          />
        </section>

        <section className="glass-panel p-8 mb-6">
          <h2 className="font-display text-xl text-ink mb-4">Side Action</h2>
          <SidePotsPanel tournamentId={tournament.id} />
        </section>

        <section className="glass-panel p-8 mb-6">
          <h2 className="font-display text-xl text-ink mb-4">Payouts</h2>
          <PayoutsPanel
            tournamentId={tournament.id}
            entryCount={entries?.length ?? 0}
            entryFee={tournament.entry_fee}
            prizeFund={tournament.prize_fund}
            cashersRatio={tournament.cashers_ratio ?? 5}
          />
        </section>

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
                  <th className="px-4 py-3 text-right">Winnings</th>
                </tr>
              </thead>
              <tbody>
                {standings?.map((row, i) => (
                  <Fragment key={row.entry_id}>
                  {paidSpots > 0 && i === paidSpots && (
                    <tr>
                      <td colSpan={7} className="px-4 py-1">
                        <div className="flex items-center gap-3">
                          <div className="bg-accent/60 h-px flex-1" />
                          <span className="text-accent text-xs font-semibold uppercase">
                            Cash line — top {paidSpots} paid
                          </span>
                          <div className="bg-accent/60 h-px flex-1" />
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-white/10">
                    <td className="px-4 py-3 text-ink">{i + 1}</td>
                    <td className="px-4 py-3 text-ink font-medium">{row.entry_name}</td>
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
                    <td className="px-4 py-3 text-right font-score text-ink">
                      {payoutFor.has(i + 1) ? formatMoney(payoutFor.get(i + 1) ?? 0) : "—"}
                    </td>
                  </tr>
                  </Fragment>
                ))}
                {!standings?.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-ink-soft">
                      No entries yet — add one above to start scoring.
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
