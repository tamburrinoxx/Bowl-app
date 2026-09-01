type M = {
  side_pot_id: string | null;
  bracket_group: number | null;
  round_number: number;
  entry_a: string | null;
  entry_b: string | null;
  winner_entry_id: string | null;
};

export default function AliveRecap({
  matches,
  names,
  pots,
}: {
  matches: M[];
  names: Record<string, string>;
  pots: { id: string; name: string }[];
}) {
  const tally: Record<string, { wins: number; round: number }> = {};
  for (const m of matches) {
    if (!m.winner_entry_id) continue;
    const t = (tally[m.winner_entry_id] ||= { wins: 0, round: 0 });
    t.wins += 1;
    t.round = Math.max(t.round, m.round_number);
  }

  const alive = Object.entries(tally)
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => b.wins - a.wins || b.round - a.round);

  if (alive.length === 0) return null;

  return (
    <section className="glass-panel mb-6 p-6">
      <h2 className="font-display text-ink mb-3 text-xl">Still alive</h2>
      <div className="space-y-1.5">
        {alive.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-1.5">
            <span className="text-ink flex-1 truncate text-sm">{names[a.id] ?? "—"}</span>
            <span className="text-ink-soft text-[11px] uppercase">Round {a.round}</span>
            <span className="font-score text-accent w-10 text-right">{a.wins}W</span>
          </div>
        ))}
      </div>
      <p className="text-ink-soft mt-2 text-[11px]">
        {pots.length > 1 ? "Wins counted across all bracket pots." : ""}
      </p>
    </section>
  );
}
