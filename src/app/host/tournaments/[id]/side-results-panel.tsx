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
  participant: string;
  payout_ratio: number;
}

interface Buyer {
  entryId: string;
  name: string;
  handicap: number;
  quantity: number;
  squad: string | null;
}

interface GameScore {
  entry_id: string;
  game_number: number;
  scratch_score: number;
}

export default function SideResultsPanel({
  tournamentId,
  bakerGames,
  gamesPerSquad,
}: {
  tournamentId: string;
  bakerGames: number;
  gamesPerSquad: number;
}) {
  const supabase = createClient();
  const [pots, setPots] = useState<SidePot[]>([]);
  const [buyers, setBuyers] = useState<Record<string, Buyer[]>>({});
  const [scores, setScores] = useState<GameScore[]>([]);
  const [squads, setSquads] = useState<{ id: string; label: string }[]>([]);
  const [squadId, setSquadId] = useState<string>("all");

  const load = useCallback(async () => {
    const { data: potData } = await supabase
      .from("side_pots")
      .select("id, name, pot_type, buy_in, scoring, participant, payout_ratio")
      .eq("tournament_id", tournamentId)
      .in("pot_type", ["high_game", "high_series"])
      .order("sort_order");

    const potList = (potData as SidePot[]) ?? [];
    setPots(potList);

    const { data: sqData } = await supabase
      .from("squads")
      .select("id,label,starts_at")
      .eq("tournament_id", tournamentId)
      .order("starts_at", { nullsFirst: false });
    setSquads((sqData ?? []) as { id: string; label: string }[]);
    if (!potList.length) return;

    const { data: buys } = await supabase
      .from("side_pot_entries")
      .select("side_pot_id, entry_id, bowler_slot, quantity")
      .in("side_pot_id", potList.map((p) => p.id));

    const buyList =
      (buys as { side_pot_id: string; entry_id: string; bowler_slot: number | null; quantity: number }[]) ?? [];
    const entryIds = [...new Set(buyList.map((b) => b.entry_id))];
    if (!entryIds.length) {
      setBuyers({});
      setScores([]);
      return;
    }

    const { data: bowlerData } = await supabase
      .from("entry_bowlers")
      .select("entry_id, position, name, handicap")
      .in("entry_id", entryIds);

    const { data: entryData } = await supabase
      .from("entries")
      .select("id, entry_name, locked_handicap, squad_id")
      .in("id", entryIds);

    const { data: gameData } = await supabase
      .from("games")
      .select("entry_id, bowler_slot, game_number, scratch_score")
      .in("entry_id", entryIds);

    const { data: bakerData } = await supabase
      .from("baker_games")
      .select("entry_id, game_number, score")
      .in("entry_id", entryIds);

    const teamName = new Map<string, string>();
    const teamHcp = new Map<string, number>();
    const teamSquad = new Map<string, string | null>();
    for (const e of (entryData as {
      id: string;
      entry_name: string;
      locked_handicap: number | null;
      squad_id: string | null;
    }[]) ?? []) {
      teamName.set(e.id, e.entry_name);
      teamHcp.set(e.id, Number(e.locked_handicap ?? 0));
      teamSquad.set(e.id, e.squad_id);
    }

    const bowlerMap = new Map<string, { name: string; handicap: number }>();
    for (const b of (bowlerData as {
      entry_id: string;
      position: number;
      name: string | null;
      handicap: number | null;
    }[]) ?? []) {
      bowlerMap.set(`${b.entry_id}:${b.position}`, {
        name: b.name ?? `Bowler ${b.position}`,
        handicap: Number(b.handicap ?? 0),
      });
    }

    const grouped: Record<string, Buyer[]> = {};
    for (const pot of potList) {
      grouped[pot.id] = buyList
        .filter((b) => b.side_pot_id === pot.id)
        .map((b) => {
          const team = (teamName.get(b.entry_id) ?? "").replace(/^MOCK /, "");
          if (pot.participant === "team") {
            return {
              entryId: `T:${b.entry_id}`,
              name: team || "Team",
              handicap: Math.round((teamHcp.get(b.entry_id) ?? 0) / 3),
              quantity: b.quantity,
            squad: teamSquad.get(b.entry_id) ?? null,
            };
          }
          const key = `${b.entry_id}:${b.bowler_slot ?? 1}`;
          const who = bowlerMap.get(key);
          return {
            entryId: key,
            name: who ? who.name : team || "Bowler",
            handicap: who?.handicap ?? 0,
            quantity: b.quantity,
            squad: teamSquad.get(b.entry_id) ?? null,
          };
        });
    }

    setBuyers(grouped);
    setScores([
      ...((gameData as {
        entry_id: string;
        bowler_slot: number | null;
        game_number: number;
        scratch_score: number;
      }[]) ?? []).map((g) => ({
        entry_id: `${g.entry_id}:${g.bowler_slot ?? 1}`,
        game_number: g.game_number,
        scratch_score: g.scratch_score,
      })),
      ...((bakerData as {
        entry_id: string;
        game_number: number;
        score: number;
      }[]) ?? []).map((g) => ({
        entry_id: `T:${g.entry_id}`,
        game_number: g.game_number,
        scratch_score: g.score,
      })),
    ]);
  }, [supabase, tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!pots.length) return null;

  return (
    <div className="space-y-8">
      {squads.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {squads.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setSquadId(q.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                squadId === q.id ? "bg-[#B6FF2E] font-bold text-black" : "bg-white/10"
              }`}
            >
              {q.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSquadId("all")}
            className={`rounded-full px-3 py-1.5 text-sm ${
              squadId === "all" ? "bg-[#B6FF2E] font-bold text-black" : "bg-white/10"
            }`}
          >
            All squads
          </button>
        </div>
      )}
      {pots.map((pot) =>
        pot.pot_type === "high_game" ? (
          <HighGamePot
            key={pot.id}
            pot={pot}
            buyers={(buyers[pot.id] ?? []).filter((b) => squadId === "all" || b.squad === squadId)}
            scores={scores}
            gamesPerSquad={pot.participant === "team" ? bakerGames : gamesPerSquad}
          />
        ) : (
          <HighSeriesPot
            key={pot.id}
            pot={pot}
            buyers={(buyers[pot.id] ?? []).filter((b) => squadId === "all" || b.squad === squadId)}
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
  // Flat whole-dollar share per game. Anything left over is surfaced as a
  // remainder rather than being silently absorbed into one game.
  const unit = 1;
  const share = Math.floor(fund / games);
  const perGame: number[] = Array.from({ length: games }, () => share);
  const remainder = fund - share * games;
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
      <PotHeader pot={pot} fund={fund} sold={sold} note={`${formatMoney(share)} per game${remainder ? ` · ${formatMoney(remainder)} left` : ""}`} />
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
                const pool = perGame[r.game - 1] ?? 0;
                // Ties split the game's pool exactly; the odd $5 goes to the
                // first name so the total still matches.
                const n = r.leaders.length || 1;
                const each = Math.floor(pool / n / 5) * 5;
                const extra = pool - each * n;
                const split = each;
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
                      {live
                        ? n > 1
                          ? `${formatMoney(split)} ea${extra ? ` +${formatMoney(extra)}` : ""}`
                          : formatMoney(pool)
                        : "—"}
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
