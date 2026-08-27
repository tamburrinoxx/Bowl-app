"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/payouts";
import {
  highGameWins,
  highSeriesWins,
  eliminatorWins,
  bracketWins,
  rollUp,
  type Buyer,
  type GameScore,
  type PotWin,
} from "@/lib/sidePots";

export default function PotRecap({
  tournamentId,
  gamesPerSquad,
}: {
  tournamentId: string;
  gamesPerSquad: number;
}) {
  const supabase = createClient();
  const [wins, setWins] = useState<PotWin[]>([]);
  const [openPots, setOpenPots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: potData } = await supabase
      .from("side_pots")
      .select("id, name, pot_type, buy_in, scoring, payout_ratio, bracket_size")
      .eq("tournament_id", tournamentId)
      .order("sort_order");

    const pots = (potData as PotRow[]) ?? [];
    if (!pots.length) {
      setLoading(false);
      return;
    }

    const { data: buyData } = await supabase
      .from("side_pot_entries")
      .select("side_pot_id, entry_id, quantity")
      .in("side_pot_id", pots.map((p) => p.id));
    const buys = (buyData as BuyRow[]) ?? [];

    const { data: entryData } = await supabase
      .from("entries")
      .select("id, entry_name, locked_handicap")
      .eq("tournament_id", tournamentId);

    const names: Record<string, string> = {};
    const hdcp: Record<string, number> = {};
    for (const e of (entryData as EntryRow[]) ?? []) {
      names[e.id] = e.entry_name;
      hdcp[e.id] = e.locked_handicap ?? 0;
    }

    const ids = Object.keys(names);
    const { data: scoreData } = await supabase
      .from("games")
      .select("entry_id, game_number, scratch_score")
      .in("entry_id", ids.length ? ids : ["none"]);
    const scores = (scoreData as GameScore[]) ?? [];

    const { data: matchData } = await supabase
      .from("tournament_matches")
      .select("side_pot_id, bracket_group, round_number, entry_a, entry_b, winner_entry_id, status")
      .eq("tournament_id", tournamentId)
      .not("side_pot_id", "is", null);

    const allWins: PotWin[] = [];
    const stillOpen: string[] = [];

    for (const pot of pots) {
      const buyers: Buyer[] = buys
        .filter((b) => b.side_pot_id === pot.id)
        .map((b) => ({
          entryId: b.entry_id,
          name: names[b.entry_id] ?? "-",
          handicap: hdcp[b.entry_id] ?? 0,
          quantity: b.quantity,
        }));

      if (!buyers.length) continue;
      const hc = pot.scoring === "handicap";
      const fee = Number(pot.buy_in);
      let potWins: PotWin[] = [];

      if (pot.pot_type === "high_game") {
        potWins = highGameWins(buyers, scores, fee, gamesPerSquad, hc);
      } else if (pot.pot_type === "high_series") {
        potWins = highSeriesWins(buyers, scores, fee, pot.payout_ratio, hc);
      } else if (pot.pot_type === "eliminator") {
        potWins = eliminatorWins(buyers, scores, fee, gamesPerSquad, hc);
      } else if (pot.pot_type === "brackets") {
        const mine = (matchData ?? []).filter((m: MatchRow) => m.side_pot_id === pot.id);
        potWins = bracketWins(mine, names, fee, pot.bracket_size || 8);
      }

      if (!potWins.length) stillOpen.push(pot.name);
      allWins.push(...potWins);
    }

    setWins(allWins);
    setOpenPots(stillOpen);
    setLoading(false);
  }, [supabase, tournamentId, gamesPerSquad]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-ink-soft text-sm">Working out the pots...</p>;
  }

  const rows = rollUp(wins);
  const owed = rows.reduce((s, r) => s + r.amount, 0);

  if (!rows.length) {
    return (
      <p className="text-ink-soft rounded-2xl bg-white/5 p-5 text-sm">
        {openPots.length
          ? `Nothing decided yet. ${openPots.join(", ")} still need scores.`
          : "No side pots on this tournament."}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-ink-soft text-xs font-medium uppercase tracking-wide">
          {rows.length} to pay
        </p>
        <p className="font-score text-accent text-lg">{formatMoney(owed)} total</p>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.entryId} className="rounded-2xl bg-white/5 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink font-medium">{r.name}</span>
              <span className="font-score text-accent text-lg">{formatMoney(r.amount)}</span>
            </div>
            <p className="text-ink-soft mt-1 text-xs">{r.lines.join(" · ")}</p>
          </div>
        ))}
      </div>

      {openPots.length > 0 && (
        <p className="text-ink-soft mt-4 text-xs">
          Still open: {openPots.join(",
cat >> "src/app/host/tournaments/[id]/pot-recap.tsx" << 'EOF_P3'

  if (loading) {
    return <p className="text-ink-soft text-sm">Working out the pots...</p>;
  }

  const rows = rollUp(wins);
  const owed = rows.reduce((s, r) => s + r.amount, 0);

  if (!rows.length) {
    return (
      <p className="text-ink-soft rounded-2xl bg-white/5 p-5 text-sm">
        {openPots.length
          ? `Nothing decided yet. ${openPots.join(", ")} still need scores.`
          : "No side pots on this tournament."}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-ink-soft text-xs font-medium uppercase tracking-wide">
          {rows.length} to pay
        </p>
        <p className="font-score text-accent text-lg">{formatMoney(owed)} total</p>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.entryId} className="rounded-2xl bg-white/5 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink font-medium">{r.name}</span>
              <span className="font-score text-accent text-lg">{formatMoney(r.amount)}</span>
            </div>
            <p className="text-ink-soft mt-1 text-xs">{r.lines.join(" · ")}</p>
          </div>
        ))}
      </div>

      {openPots.length > 0 && (
        <p className="text-ink-soft mt-4 text-xs">
          Still open: {openPots.join(", ")}. Those need every buyer scored first.
        </p>
      )}
    </div>
  );
}

interface PotRow {
  id: string;
  name: string;
  pot_type: string;
  buy_in: number;
  scoring: string;
  payout_ratio: number;
  bracket_size: number;
}

interface BuyRow {
  side_pot_id: string;
  entry_id: string;
  quantity: number;
}

interface EntryRow {
  id: string;
  entry_name: string;
  locked_handicap: number | null;
}

interface MatchRow {
  side_pot_id: string;
  bracket_group: number | null;
  round_number: number;
  entry_a: string | null;
  entry_b: string | null;
  winner_entry_id: string | null;
  status: string;
}
