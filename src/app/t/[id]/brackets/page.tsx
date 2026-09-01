import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/nav-bar";
import { BracketTree } from "@/components/bracket-tree";
import AliveRecap from "./alive-recap";
import { bracketPayout } from "@/lib/bracketPots";

export default async function PublicBracketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, center_name")
    .eq("id", id)
    .single();

  if (!tournament) {
    return (
      <main className="min-h-screen px-6 py-12">
        <p className="text-ink-soft mx-auto max-w-2xl">Tournament not found.</p>
      </main>
    );
  }

  const { data: pots } = await supabase
    .from("side_pots")
    .select("id, name, buy_in, bracket_size")
    .eq("tournament_id", id)
    .eq("pot_type", "brackets")
    .order("sort_order");

  const { data: matches } = await supabase
    .from("tournament_matches")
    .select(
      "id, side_pot_id, bracket_group, round_number, match_number, entry_a, entry_b, seed_a, seed_b, score_a, score_b, winner_entry_id, status",
    )
    .eq("tournament_id", id)
    .not("side_pot_id", "is", null)
    .order("bracket_group")
    .order("round_number")
    .order("match_number");

  const { data: entries } = await supabase
    .from("entries")
    .select("id, entry_name")
    .eq("tournament_id", id);

  const names: Record<string, string> = {};
  for (const e of (entries as { id: string; entry_name: string }[]) ?? []) {
    names[e.id] = e.entry_name;
  }

  const allMatches = matches ?? [];

  return (
    <>
      <NavBar
        crumbs={[
          { label: "Tournaments", href: "/t" },
          { label: tournament.name, href: `/t/${id}` },
          { label: "Brackets" },
        ]}
        backHref={`/t/${id}`}
        links={[
          { label: "Standings", href: `/t/${id}` },
          { label: "Your day", href: `/t/${id}/me` },
        ]}
      />
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="font-score text-accent mb-2 text-[13px] font-semibold uppercase tracking-[0.2em]">
            {tournament.name}
          </p>
          <h1 className="font-display text-ink mb-8 text-4xl leading-none">
            Brackets
          </h1>

          {allMatches.length > 0 && (
            <AliveRecap
              matches={allMatches}
              names={names}
              pots={(pots as { id: string; name: string; buy_in: number; bracket_size: number }[]) ?? []}
            />
          )}

          {!allMatches.length && (
            <p className="glass-panel text-ink-soft p-8 text-sm">
              Brackets haven&apos;t been drawn yet. Check back once the host
              finalises them.
            </p>
          )}

          {(pots ?? []).map((pot) => {
            const mine = allMatches.filter((m) => m.side_pot_id === pot.id);
            if (!mine.length) return null;

            const groups = [...new Set(mine.map((m) => m.bracket_group))].sort(
              (a, b) => (a ?? 0) - (b ?? 0),
            );
            const pay = bracketPayout(Number(pot.buy_in), pot.bracket_size || 8);

            return (
              <div key={pot.id} className="mb-8">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-ink-soft text-[13px] font-medium uppercase tracking-wide">
                    {pot.name}
                  </p>
                  <p className="font-score text-ink-soft text-[13px]">
                    Winner ${pay.winner} · Runner-up ${pay.runnerUp}
                  </p>
                </div>

                <div className="space-y-4">
                  {groups.map((g) => {
                    const inGroup = mine.filter((m) => m.bracket_group === g);
                    return (
                      <div key={g} className="glass-panel p-6">
                        <p className="font-display text-ink mb-4 text-lg">
                          Bracket {g}
                        </p>
                        <BracketTree
                          matches={inGroup}
                          names={names}
                          winnerPay={pay.winner}
                          runnerUpPay={pay.runnerUp}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <Link
            href={`/t/${id}`}
            className="text-accent mt-6 inline-block text-sm hover:brightness-110"
          >
            ← Back to standings
          </Link>
        </div>
      </main>
    </>
  );
}
