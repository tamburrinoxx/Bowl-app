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

interface Buyer {
  entryId: string;
  name: string;
  handicap: number;
  quantity: number;
}

interface GameScore {
  entry_id: string;
  game_number: number;
  scratch_score: number;
}

export default function SideResultsPanel({
  tournamentId,
  gamesPerSquad,
}: {
  tournamentId: string;
  gamesPerSquad: number;
}) {
  const supabase = createClient();
  const [pots, setPots] = useState<SidePot[]>([]);
  const [buyers, setBuyers] = useState<Record<string, Buyer[]>>({});
  const [scores, setScores] = useState<GameScore[]>([]);

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
      setBuyers({});
      setScores([]);
      return;
    }

    const { data: entryData } = await supabase
      .from("entries")
      .select("id, entry_name, locked_handicap")
      .in("id", entryIds);

    const { data: gameData } = await supabase
      .from("games")
      .select("entry_id, game_number, scratch_score")
      .in("entry_id", entryIds);

    const entryMap = new Map(
      (entryData as { id: string; entry_name: string; locked_handicap: number | null }[])
        ?.map((e) => [e.id, e]) ?? [],
    );

    const grouped: Record<string, Buyer[]> = {};
    for (const pot of potList) {
      grouped[pot.id] = buyList
        .filter((b) => b.side_pot_id === pot.id)
        .map((b) => {
          const e = entryMap.get(b.entry_id);
          return {
            entryId: b.entry_id,
            name: e?.entry_name ?? "—",
            handicap: e?.locked_handicap ?? 0,
            quantity: b.quantity,
          };
        });
    }

    setBuyers(grouped);
    setScores((gameData as GameScore[]) ?? []);
  }, [supabase, tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!pots.length) return null;

  return (
    <div className="space-y-8">
      {pots.map((pot) =>
        pot.pot_type === "high_game" ? (
          <HighGamePot
            key={pot.id}
            pot={pot}
            buyers={buyers[pot.id] ?? []}
            scores={scores}
            gamesPerSquad={gamesPerSquad}
          />
        ) : (
          <HighSeriesPot
            key={pot.id}
            pot={pot}
            buyers={buyers[pot.id] ?? []}
            scores={scores}
          />
        ),
      )}
    </div>
  );
}

function PotHeader({
  pot,
  fund,
  sold,
  note,
}: {
  pot: SidePot;
  fund: number;
  sold: number;
  note: string;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-ink font-medium">
        {pot.name}
        <span className="text-ink-soft ml-2 text-xs uppercase">{pot.scoring}</span>
      </p>
      <p className="font-score text-accent text-sm">
        {formatMoney(fund)} · {sold} in · {note}
      </p>
    </div>
  );
}

/** Pays the top score in every game, fund split evenly across games. */
function HighGamePot({
  pot,
  buyers,
  scores,
  gamesPerSquad,
}: {
  pot: SidePot;
  buyers: Buyer[];
  scores: GameScore[];
  gamesPerSquad: number;
}) {
  const sold = buyers.reduce((s, b) => s + b.quantity, 0);
  const fund = sold * Number(pot.buy_in);
  const games = Math.max(1, gamesPerSquad);
  const perGame = Math.round(fund / games / 5) * 5;
  const inPot = new Map(buyers.map((b) => [b.entryId, b]));

  const rows = Array.from({ length: games }, (_, i) => i + 1).map((n) => {
    const forGame = scores
      .filter((s) => s.game_number === n && inPot.has(s.entry_id))
      .map((s) => {
        const b = inPot.get(s.entry_id)!;
        const hdcp = pot.scoring === "handicap" ? b.handicap : 0;
        return { name: b.name, total: s.scratch_score + hdcp };
      });

    if (!forGame.length) return { game: n, leaders: [] as string[], score: 0 };

    const top = Math.max(...forGame.map((f) => f.total));
    return {
      game: n,
      leaders: forGame.filter((f) => f.total === top).map((f) => f.name),
      score: top,
    };
  });

  return (
    <div>
      <PotHeader pot={pot} fund={fund} sold={sold} note={`${formatMoney(perGame)} per game`} />
      {buyers.length === 0 ? (
        <p className="text-ink-soft rounded-2xl bg-white/5 p-4 text-sm">
          Nobody in this pot yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-soft text-left text-xs uppercase">
                <th className="px-4 py-2">Game</th>
                <th className="px-4 py-2">Leader</th>
                <th className="px-4 py-2 text-right">Score</th>
                <th className="px-4 py-2 text-right">Pays</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const live = r.leaders.length > 0;
                const split = live ? Math.round(perGame / r.leaders.length / 5) * 5 : 0;
                return (
                  <tr
                    key={r.game}
                    className={`border-t border-white/10 ${live ? "bg-accent/10" : ""}`}
                  >
                    <td className="text-ink-soft px-4 py-2">{r.game}</td>
                    <td className={live ? "text-accent px-4 py-2 font-medium" : "text-ink-soft px-4 py-2"}>
                      {live ? r.leaders.join(", ") : "not bowled yet"}
                      {r.leaders.length > 1 && (
                        <span className="text-ink-soft ml-2 text-xs">tied — split</span>
                      )}
                    </td>
                    <td className="font-score text-ink px-4 py-2 text-right">
                      {r.score || "—"}
                    </td>
                    <td className="font-score text-accent px-4 py-2 text-right">
                      {live ? formatMoney(split) : "—"}
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
}

/** One leaderboard on total series, paying 1 in N of the buyers. */
function HighSeriesPot({
  pot,
  buyers,
  scores,
}: {
  pot: SidePot;
  buyers: Buyer[];
  scores: GameScore[];
}) {
  const sold = buyers.reduce((s, b) => s + b.quantity, 0);
  const fund = sold * Number(pot.buy_in);
  const spots = cashingSpots(sold, pot.payout_ratio || 5);
  const payFor = new Map(distributePayouts(fund, spots).map((p) => [p.position, p.amount]));

  const rows = buyers
    .map((b) => {
      const mine = scores.filter((s) => s.entry_id === b.entryId);
      const hdcp = pot.scoring === "handicap" ? b.handicap : 0;
      const total = mine.reduce((s, g) => s + g.scratch_score + hdcp, 0);
      return { ...b, total, games: mine.length };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <PotHeader pot={pot} fund={fund} sold={sold} note={`${spots} paid`} />
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
                <th className="px-4 py-2 text-right">Series</th>
                <th className="px-4 py-2 text-right">Pays</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const inMoney = i < spots && r.total > 0;
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
                    <td className="font-score text-ink px-4 py-2 text-right">
                      {r.total || "—"}
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
}
