import { bracketPayout } from "@/lib/bracketPots";
import { formatMoney } from "@/lib/payouts";

type M = {
  side_pot_id: string | null;
  bracket_group: number | null;
  round_number: number;
  entry_a: string | null;
  entry_b: string | null;
  winner_entry_id: string | null;
};

type Pot = { id: string; name: string; buy_in: number; bracket_size: number };

export default function AliveRecap({
  matches,
  names,
  pots,
}: {
  matches: M[];
  names: Record<string, string>;
  pots: Pot[];
}) {
  const potById: Record<string, Pot> = {};
  for (const p of pots) potById[p.id] = p;

  const stat: Record<string, { wins: number; first: number; second: number; money: number }> = {};
  const get = (id: string) => (stat[id] ||= { wins: 0, first: 0, second: 0, money: 0 });

  // final round per bracket group decides 1st and 2nd
  const lastRound: Record<string, number> = {};
  for (const m of matches) {
    const key = `${m.side_pot_id}:${m.bracket_group}`;
    lastRound[key] = Math.max(lastRound[key] ?? 0, m.round_number);
  }

  for (const m of matches) {
    if (!m.winner_entry_id) continue;
    get(m.winner_entry_id).wins += 1;

    const key = `${m.side_pot_id}:${m.bracket_group}`;
    if (m.round_number !== lastRound[key]) continue;

    const pot = m.side_pot_id ? potById[m.side_pot_id] : undefined;
    if (!pot) continue;
    const pay = bracketPayout(Number(pot.buy_in), pot.bracket_size || 8);

    const loser = m.entry_a === m.winner_entry_id ? m.entry_b : m.entry_a;
    const w = get(m.winner_entry_id);
    w.first += 1;
    w.money += pay.winner;
    if (loser) {
      const l = get(loser);
      l.second += 1;
      l.money += pay.runnerUp;
    }
  }

  const rows = Object.entries(stat)
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => b.money - a.money || b.first - a.first || b.wins - a.wins);

  if (rows.length === 0) return null;

  return (
    <section className="glass-panel mb-6 p-6">
      <h2 className="font-display text-ink mb-3 text-xl">Bracket recap</h2>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-1.5">
            <span className="text-ink min-w-0 flex-1 truncate text-base">{names[r.id] ?? "—"}</span>
            <span className="text-ink-soft w-14 text-center text-sm">{r.wins}W</span>
            <span className="text-ink w-16 text-center text-sm">
              {r.first > 0 ? `${r.first}\u00d7 1st` : ""}
            </span>
            <span className="text-ink-soft w-16 text-center text-sm">
              {r.second > 0 ? `${r.second}\u00d7 2nd` : ""}
            </span>
            <span className="font-score text-accent w-20 text-right text-lg">
              {r.money > 0 ? formatMoney(r.money) : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
