"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cashingSpots, distributePayouts, formatMoney } from "@/lib/payouts";

interface SidePot {
  id: string;
  name: string;
  pot_type: string;
  buy_in: number;
  scoring: string;
  payout_ratio: number;
}

interface Contender {
  entryId: string;
  name: string;
  handicap: number;
  best: number;
  series: number;
  games: number;
  quantity: number;
}

export default function SideResultsPanel({ tournamentId }: { tournamentId: string }) {
  const supabase = createClient();
  const [pots, setPots] = useState<SidePot[]>([]);
  const [byPot, setByPot] = useState<Record<string, Contender[]>>({});

  const load = useCallback(async () => {
    const { data: potData } = await supabase
      .from("side_pots")
      .select("id, name, pot_type, buy_in, scoring, payout_ratio")
      .eq("tournament_id", tournamentId)
      .in("pot_type", ["high_game", "high_series"])
      .order("sort_order");

    const potList = (potData as SidePot[]) ?? [];
    setPots(potList);
    if (!potList.length) return;

    const { data: buys } = await supabase
      .from("side_pot_entries")
      .select("side_pot_id, entry_id, quantity")
      .in("side_pot_id", potList.map((p) => p.id));

    const buyList =
      (buys as { side_pot_id: string; entry_id: string; quantity: number }[]) ?? [];
    const entryIds = [...new Set(buyList.map((b) => b.entry_id))];
    if (!entryIds.length) {
      setByPot({});
      return;
    }

    const { data: entryData } = await supabase
      .from("entries")
      .select("id, entry_name, locked_handicap")
      .in("id", entryIds);

    const { data: gameData } = await supabase
      .from("games")
      .select("entry_id, scratch_score")
      .in("entry_id", entryIds);

    const entryMap = new Map(
      (entryData as { id: string; entry_name: string; locked_handicap: number | null }[])
        ?.map((e) => [e.id, e]) ?? [],
    );

    const stats = new Map<string, { best: number; total: number; count: number }>();
    for (const g of (gameData as { entry_id: string; scratch_score: number }[]) ?? []) {
      const cur = stats.get(g.entry_id) ?? { best: 0, total: 0, count: 0 };
      cur.best = Math.max(cur.best, g.scratch_score);
      cur.total += g.scratch_score;
      cur.count += 1;
      stats.set(g.entry_id, cur);
    }

    const grouped: Record<string, Contender[]> = {};
    for (const pot of potList) {
      const rows: Contender[] = buyList
        .filter((b) => b.side_pot_id === pot.id)
        .map((b) => {
          const e = entryMap.get(b.entry_id);
          const st = stats.get(b.entry_id) ?? { best: 0, total: 0, count: 0 };
          const hdcp = pot.scoring === "handicap" ? (e?.locked_handicap ?? 0) : 0;
          return {
            entryId: b.entry_id,
            name: e?.entry_name ?? "—",
            handicap: hdcp,
            best: st.best > 0 ? st.best + hdcp : 0,
            series: st.total > 0 ? st.total + hdcp * st.count : 0,
            games: st.count,
            quantity: b.quantity,
          };
        });

      rows.sort((a, b) =>
        pot.pot_type === "high_game" ? b.best - a.best : b.series - a.series,
      );
      grouped[pot.id] = rows;
    }

    setByPot(grouped);
  }, [supabase, tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!pots.length) return null;

  return (
    <div className="space-y-6">
      {pots.map((pot) => {
        const rows = byPot[pot.id] ?? [];
        const sold = rows.reduce((s, r) => s + r.quantity, 0);
        const fund = sold * Number(pot.buy_in);
        const spots = cashingSpots(sold, pot.payout_ratio || 5);
        const payouts = distributePayouts(fund, spots);
        const payFor = new Map(payouts.map((p) => [p.position, p.amount]));
        const isGame = pot.pot_type === "high_game";

        return (
          <div key={pot.id}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-ink font-medium">
                {pot.name}
                <span className="text-ink-soft ml-2 text-xs uppercase">{pot.scoring}</span>
              </p>
              <p className="font-score text-accent text-sm">
                {formatMoney(fund)} · {sold} in · {spots} paid
              </p>
            </div>

            {rows.length === 0 ? (
              <p className="text-ink-soft rounded-2xl bg-white/5 p-4 text-sm">
                Nobody in this pot yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl bg-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-ink-soft text-left text-xs uppercase">
                      <th className="px-4 py-2">#</th>
                      <th className="px-4 py-2">Entry</th>
                      <th className="px-4 py-2 text-right">
                        {isGame ? "High Game" : "Series"}
                      </th>
                      <th className="px-4 py-2 text-right">Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const inMoney = i < spots && (isGame ? r.best : r.series) > 0;
                      return (
                        <tr
                          key={r.entryId}
                          className={`border-t border-white/10 ${inMoney ? "bg-accent/10" : ""}`}
                        >
                          <td className="text-ink-soft px-4 py-2">{i + 1}</td>
                          <td className={inMoney ? "text-accent px-4 py-2 font-medium" : "text-ink px-4 py-2"}>
                            {r.name}
                            {r.games === 0 && (
                              <span className="text-ink-soft ml-2 text-xs">no scores yet</span>
                            )}
                          </td>
                          <td className="font-score px-4 py-2 text-right text-ink">
                            {(isGame ? r.best : r.series) || "—"}
                          </td>
                          <td className="font-score text-accent px-4 py-2 text-right">
                            {inMoney ? formatMoney(payFor.get(i + 1) ?? 0) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
