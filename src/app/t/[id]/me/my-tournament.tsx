"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cashingSpots, distributePayouts, formatMoney } from "@/lib/payouts";
import { bracketPayout } from "@/lib/bracketPots";

interface Standing {
  entry_id: string;
  entry_name: string;
  handicap_total: number;
  scratch_total: number;
  games_played: number;
}

interface PotBuy {
  potId: string;
  name: string;
  potType: string;
  buyIn: number;
  scoring: string;
  payoutRatio: number;
  quantity: number;
}

export default function MyTournament({
  tournamentId,
  gamesPerSquad,
}: {
  tournamentId: string;
  gamesPerSquad: number;
}) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [myGames, setMyGames] = useState<{ game_number: number; scratch_score: number }[]>([]);
  const [handicap, setHandicap] = useState(0);
  const [payouts, setPayouts] = useState<{ position: number; amount: number }[]>([]);
  const [pots, setPots] = useState<PotBuy[]>([]);
  const [allScores, setAllScores] = useState
    { entry_id: string; game_number: number; scratch_score: number }[]
  >([]);
  const [potFieldSizes, setPotFieldSizes] = useState<Record<string, number>>({});
  const [potMembers, setPotMembers] = useState<Record<string, string[]>>({});
  const [handicapBy, setHandicapBy] = useState<Record<string, number>>({});
  const [brackets, setBrackets] = useState
    { group: number | null; potName: string; buyIn: number; alive: boolean; won: boolean }[]
  >([]);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSignedIn(false);
      setLoading(false);
      return;
    }
    setSignedIn(true);

    const { data: tEntries } = await supabase
      .from("entries")
      .select("id, entry_name, locked_handicap")
      .eq("tournament_id", tournamentId);

    const entryList =
      (tEntries as { id: string; entry_name: string; locked_handicap: number | null }[]) ?? [];
    const hdcpMap: Record<string, number> = {};
    for (const e of entryList) hdcpMap[e.id] = e.locked_handicap ?? 0;
    setHandicapBy(hdcpMap);

    const ids = entryList.map((e) => e.id);
    let mineId: string | null = null;
    if (ids.length) {
      const { data: links } = await supabase
        .from("entry_bowlers")
        .select("entry_id")
        .eq("bowler_id", user.id)
        .in("entry_id", ids);
      mineId = links?.[0]?.entry_id ?? null;
    }
    setEntryId(mineId);
    if (mineId) setHandicap(hdcpMap[mineId] ?? 0);

    const { data: st } = await supabase
      .from("standings")
      .select("entry_id, entry_name, handicap_total, scratch_total, games_played")
      .eq("tournament_id", tournamentId)
      .order("handicap_total", { ascending: false });
    setStandings((st as Standing[]) ?? []);

    const { data: pay } = await supabase
      .from("tournament_payouts")
      .select("position, amount")
      .eq("tournament_id", tournamentId)
      .order("position");
    setPayouts((pay as { position: number; amount: number }[]) ?? []);

    const { data: scores } = await supabase
      .from("games")
      .select("entry_id, game_number, scratch_score")
      .in("entry_id", ids.length ? ids : ["none"]);
    const scoreList =
      (scores as { entry_id: string; game_number: number; scratch_score: number }[]) ?? [];
    setAllScores(scoreList);
    if (mineId) {
      setMyGames(
        scoreList
          .filter((g) => g.entry_id === mineId)
          .map((g) => ({ game_number: g.game_number, scratch_score: g.scratch_score }))
          .sort((a, b) => a.game_number - b.game_number),
      );
    }

    const { data: potData } = await supabase
      .from("side_pots")
      .select("id, name, pot_type, buy_in, scoring, payout_ratio, bracket_size")
      .eq("tournament_id", tournamentId)
      .order("sort_order");

    const potList =
      (potData as {
        id: string;
        name: string;
        pot_type: string;
        buy_in: number;
        scoring: string;
        payout_ratio: number;
        bracket_size: number;
      }[]) ?? [];

    if (potList.length) {
      const { data: buys } = await supabase
        .from("side_pot_entries")
        .select("side_pot_id, entry_id, quantity")
        .in("side_pot_id", potList.map((p) => p.id));

      const buyList =
        (buys as { side_pot_id: string; entry_id: string; quantity: number }[]) ?? [];

      const sizes: Record<string, number> = {};
      const members: Record<string, string[]> = {};
      for (const b of buyList) {
        sizes[b.side_pot_id] = (sizes[b.side_pot_id] ?? 0) + b.quantity;
        (members[b.side_pot_id] ??= []).push(b.entry_id);
      }
      setPotFieldSizes(sizes);
      setPotMembers(members);

      setPots(
        buyList
          .filter((b) => b.entry_id === mineId)
          .map((b) => {
            const p = potList.find((x) => x.id === b.side_pot_id)!;
            return {
              potId: p.id,
              name: p.name,
              potType: p.pot_type,
              buyIn: Number(p.buy_in),
              scoring: p.scoring,
              payoutRatio: p.payout_ratio || 5,
              quantity: b.quantity,
            };
          }),
      );

      if (mineId) {
        const { data: ms } = await supabase
          .from("tournament_matches")
          .select("side_pot_id, bracket_group, round_number, entry_a, entry_b, winner_entry_id, status")
          .eq("tournament_id", tournamentId)
          .not("side_pot_id", "is", null);

        const matchList =
          (ms as {
            side_pot_id: string;
            bracket_group: number | null;
            round_number: number;
            entry_a: string | null;
            entry_b: string | null;
            winner_entry_id: string | null;
            status: string;
          }[]) ?? [];

        const groupKeys = [
          ...new Set(
            matchList
              .filter((m) => m.entry_a === mineId || m.entry_b === mineId)
              .map((m) => `${m.side_pot_id}:${m.bracket_group}`),
          ),
        ];

        setBrackets(
          groupKeys.map((k) => {
            const [potId, grp] = k.split(":");
            const inGroup = matchList.filter(
              (m) => m.side_pot_id === potId && String(m.bracket_group) === grp,
            );
            const lastRound = Math.max(...inGroup.map((m) => m.round_number));
            const lost = inGroup.some(
              (m) =>
                m.status === "complete" &&
                (m.entry_a === mineId || m.entry_b === mineId) &&
                m.winner_entry_id !== mineId,
            );
            const finalMatch = inGroup.find((m) => m.round_number === lastRound);
            const pot = potList.find((p) => p.id === potId);
            return {
              group: Number(grp),
              potName: pot?.name ?? "Brackets",
              buyIn: Number(pot?.buy_in ?? 0),
              alive: !lost,
              won: finalMatch?.winner_entry_id === mineId,
            };
          }),
        );
      }
    }

    setLoading(false);
  }, [supabase, tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="glass-panel text-ink-soft p-8 text-sm">Loading…</p>;
  }

  if (!signedIn) {
    return (
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 p-8">
        <p className="text-ink-soft text-sm">
          Sign in to see your scores, standing and winnings.
        </p>
        <Link href="/login" className="pill-button bg-accent text-on-accent px-5 py-2.5 text-sm">
          Sign in
        </Link>
      </div>
    );
  }

  if (!entryId) {
    return (
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 p-8">
        <p className="text-ink-soft text-sm">You&apos;re not entered in this tournament.</p>
        <Link href={`/t/${tournamentId}`} className="pill-button bg-accent text-on-accent px-5 py-2.5 text-sm">
          Join
        </Link>
      </div>
    );
  }

  const myIndex = standings.findIndex((s) => s.entry_id === entryId);
  const me = standings[myIndex];
  const position = myIndex + 1;
  const payFor = new Map(payouts.map((p) => [p.position, Number(p.amount)]));
  const mainWinnings = payFor.get(position) ?? 0;
  const cashLine = payouts.length;
  const scratchTotal = myGames.reduce((s, g) => s + g.scratch_score, 0);

  let sideWinnings = 0;
  const potRows = pots.map((pot) => {
    const members = potMembers[pot.potId] ?? [];
    const fund = (potFieldSizes[pot.potId] ?? 0) * pot.buyIn;

    if (pot.potType === "high_game") {
      const share = Math.floor(fund / Math.max(1, gamesPerSquad));
      const leading: number[] = [];
      for (let n = 1; n <= gamesPerSquad; n++) {
        const inGame = allScores
          .filter((s) => s.game_number === n && members.includes(s.entry_id))
          .map((s) => ({
            id: s.entry_id,
            total: s.scratch_score + (pot.scoring === "handicap" ? (handicapBy[s.entry_id] ?? 0) : 0),
          }));
        if (!inGame.length) continue;
        const top = Math.max(...inGame.map((x) => x.total));
        if (inGame.some((x) => x.id === entryId && x.total === top)) leading.push(n);
      }
      sideWinnings += leading.length * share;
      return {
        key: pot.potId,
        name: pot.name,
        detail: leading.length
          ? `Leading game${leading.length > 1 ? "s" : ""} ${leading.join(", ")}`
          : "Not leading a game",
        amount: leading.length * share,
      };
    }

    if (pot.potType === "high_series") {
      const totals = members
        .map((id) => {
          const gs = allScores.filter((s) => s.entry_id === id);
          const h = pot.scoring === "handicap" ? (handicapBy[id] ?? 0) : 0;
          return { id, total: gs.reduce((s, g) => s + g.scratch_score + h, 0) };
        })
        .sort((a, b) => b.total - a.total);
      const idx = totals.findIndex((t) => t.id === entryId);
      const spots = cashingSpots(potFieldSizes[pot.potId] ?? 0, pot.payoutRatio);
      const amounts = distributePayouts(fund, spots);
      const amt = idx >= 0 && idx < spots ? (amounts[idx]?.amount ?? 0) : 0;
      sideWinnings += amt;
      return {
        key: pot.potId,
        name: pot.name,
        detail: `${idx + 1} of ${totals.length}${amt ? " — in the money" : ""}`,
        amount: amt,
      };
    }

    return { key: pot.potId, name: pot.name, detail: `${pot.quantity} bought`, amount: 0 };
  });

  const bracketWinnings = brackets.reduce(
    (s, b) => s + (b.won ? bracketPayout(b.buyIn).winner : 0),
    0,
  );
  const total = mainWinnings + sideWinnings + bracketWinnings;

  return (
    <div className="space-y-6">
      <div className="glass-panel p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-ink-soft text-xs uppercase tracking-wide">Position</p>
            <p className="font-score text-accent text-5xl">
              {position || "—"}
              <span className="text-ink-soft ml-2 text-lg">of {standings.length}</span>
            </p>
            <p className="text-ink-soft mt-1 text-sm">
              {me?.entry_name} · {me?.handicap_total ?? 0} total · {handicap} hdcp/game
            </p>
          </div>
          <div className="text-right">
            <p className="text-ink-soft text-xs uppercase tracking-wide">Winning now</p>
            <p className="font-score text-accent text-4xl">{formatMoney(total)}</p>
          </div>
        </div>

        {cashLine > 0 && (
          <p className="text-ink-soft mt-4 text-xs">
            {position <= cashLine
              ? `In the money — top ${cashLine} cash.`
              : `${position - cashLine} spot${position - cashLine === 1 ? "" : "s"} out of the money.`}
          </p>
        )}
      </div>

      <div className="glass-panel p-8">
        <p className="text-ink-soft mb-3 text-xs font-medium uppercase tracking-wide">
          Your games
        </p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: gamesPerSquad }, (_, i) => i + 1).map((n) => {
            const g = myGames.find((x) => x.game_number === n);
            return (
              <div
                key={n}
                className={`rounded-2xl px-4 py-3 text-center ${g ? "bg-accent/15" : "bg-white/5"}`}
              >
                <span className="text-ink-soft block text-xs">G{n}</span>
                <span className={`font-score block text-xl ${g ? "text-accent" : "text-ink-soft"}`}>
                  {g ? g.scratch_score : "—"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-ink-soft mt-3 text-sm">
          Scratch <span className="font-score text-ink">{scratchTotal}</span> · With handicap{" "}
          <span className="font-score text-ink">{me?.handicap_total ?? 0}</span>
        </p>
      </div>

      {(potRows.length > 0 || brackets.length > 0) && (
        <div className="glass-panel p-8">
          <p className="text-ink-soft mb-3 text-xs font-medium uppercase tracking-wide">
            Your side action
          </p>
          <div className="space-y-2">
            {potRows.map((r) => (
              <div
                key={r.key}
                className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm"
              >
                <span className="text-ink">
                  {r.name}
                  <span className="text-ink-soft ml-2 text-xs">{r.detail}</span>
                </span>
                <span className={`font-score ${r.amount ? "text-accent" : "text-ink-soft"}`}>
                  {r.amount ? formatMoney(r.amount) : "—"}
                </span>
              </div>
            ))}

            {brackets.map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm"
              >
                <span className="text-ink">
                  {b.potName} #{b.group}
                  <span className="text-ink-soft ml-2 text-xs">
                    {b.won ? "won" : b.alive ? "still alive" : "eliminated"}
                  </span>
                </span>
                <span className={`font-score ${b.won ? "text-accent" : "text-ink-soft"}`}>
                  {b.won ? formatMoney(bracketPayout(b.buyIn).winner) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
