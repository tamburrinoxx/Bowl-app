import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { StandingsRow, Tournament } from "@/types";
import BowlerPanel from "./bowler-panel";
import StandingsBoard from "./standings-board";
import SideResultsPanel from "@/app/host/tournaments/[id]/side-results-panel";
import { NavBar } from "@/components/nav-bar";
import { formatMoney } from "@/lib/payouts";

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
    <>
      <NavBar
        crumbs={[
          { label: "Tournaments", href: "/t" },
          { label: tournament.name },
        ]}
        backHref="/t"
        links={[
          { label: "Your day", href: `/t/${id}/me` },
          { label: "Brackets", href: `/t/${id}/brackets` },
          { label: "All tournaments", href: "/t" },
        ]}
      />
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

        <div className="mb-6 flex justify-end">
          <Link
            href={`/t/${id}/me`}
            className="pill-button bg-accent text-on-accent px-5 py-2.5 text-sm hover:brightness-110"
          >
            Your day →
          </Link>
        </div>

        <BowlerPanel
          tournamentId={tournament.id}
          tournamentStatus={tournament.status}
          gamesPerSquad={tournament.games_per_squad}
          handicapBase={tournament.handicap_base}
          handicapPercent={tournament.handicap_percent}
        />

        <section className="glass-panel p-8">
          <h2 className="font-display text-xl text-ink mb-4">Standings</h2>
          <StandingsBoard
            rows={standings ?? []}
            payouts={payouts ?? []}
            gamesPerSquad={tournament.games_per_squad}
            showTicker={tournament.show_ticker ?? true}
          />
        </section>

        <section className="glass-panel p-8 mt-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl text-ink">Side Action</h2>
            <Link
              href={`/t/${id}/brackets`}
              className="text-accent text-sm hover:brightness-110"
            >
              View brackets →
            </Link>
          </div>
          <SideResultsPanel
            tournamentId={tournament.id}
            gamesPerSquad={tournament.games_per_squad}
          />
        </section>
      </div>
    </main>
    </>
  );
}
