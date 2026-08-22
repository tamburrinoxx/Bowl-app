import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";

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
      "id, side_pot_id, bracket_group, round_number, match_number, entry_a, entry_b, score_a, score_b, winner_entry_id, status",
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

  const names = new Map(
    (entries as { id: string; entry_name: string }[])?.map((e) => [e.id, e.entry_name]) ?? [],
  );

  const allMatches = matches ?? [];

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Logo className="mb-3 text-2xl" />
        <Link
          href={`/t/${id}`}
          className="text-accent mb-4 inline-block text-sm hover:brightness-110"
        >
          ← {tournament.name}
        </Link>
        <h1 className="font-display text-ink mb-8 text-4xl">Brackets</h1>

        {!allMatches.length && (
          <p className="glass-panel text-ink-soft p-8 text-sm">
            Brackets haven&apos;t been drawn yet. Check back once the host finalises them.
          </p>
        )}

        {(pots ?? []).map((pot) => {
          const mine = allMatches.filter((m) => m.side_pot_id === pot.id);
          if (!mine.length) return null;
          const groups = [...new Set(mine.map((m) => m.bracket_group))].sort(
            (a, b) => (a ?? 0) - (b ?? 0),
          );

          return (
            <div key={pot.id} className="mb-8">
              <p className="text-ink-soft mb-3 text-xs font-medium uppercase tracking-wide">
                {pot.name}
              </p>

              <div className="space-y-4">
                {groups.map((g) => {
                  const inGroup = mine.filter((m) => m.bracket_group === g);
                  const rounds = [...new Set(inGroup.map((m) => m.round_number))].sort(
                    (a, b) => a - b,
                  );
                  const lastRound = Math.max(...rounds);
                  const champ = inGroup.find((m) => m.round_number === lastRound)
                    ?.winner_entry_id;

                  return (
                    <div key={g} className="glass-panel p-6">
                      <div className="mb-4 flex items-baseline justify-between gap-3">
                        <p className="font-display text-ink text-lg">Bracket {g}</p>
                        {champ && (
                          <p className="font-score text-accent text-sm">
                            {names.get(champ)} wins
                          </p>
                        )}
                      </div>

                      <div className="space-y-4">
                        {rounds.map((r) => (
                          <div key={r}>
                            <p className="text-ink-soft mb-2 text-xs uppercase tracking-wide">
                              {r === lastRound ? "Final" : `Round ${r}`}
                            </p>
                            <div className="space-y-2">
                              {inGroup
                                .filter((m) => m.round_number === r)
                                .map((m) => {
                                  const done = m.status === "complete";
                                  return (
                                    <div
                                      key={m.id}
                                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm"
                                    >
                                      <span>
                                        <span
                                          className={
                                            done && m.winner_entry_id === m.entry_a
                                              ? "text-accent font-medium"
                                              : "text-ink"
                                          }
                                        >
                                          {m.entry_a ? names.get(m.entry_a) : "TBD"}
                                        </span>
                                        <span className="text-ink-soft mx-2">vs</span>
                                        <span
                                          className={
                                            done && m.winner_entry_id === m.entry_b
                                              ? "text-accent font-medium"
                                              : "text-ink"
                                          }
                                        >
                                          {m.entry_b ? names.get(m.entry_b) : "TBD"}
                                        </span>
                                      </span>
                                      <span className="font-score text-ink-soft">
                                        {done ? `${m.score_a} – ${m.score_b}` : "—"}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
