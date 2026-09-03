"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/payouts";

type Pot = { id: string; name: string; buy_in: number };
type Row = {
  entryId: string;
  name: string;
  scores: Record<number, number>;
  total: number;
  cutAfter: number | null;
};

export default function EliminatorPanel({
  tournamentId,
  gamesPerSquad,
}: {
  tournamentId: string;
  gamesPerSquad: number;
}) {
  const supabase = createClient();
  const [pot, setPot] = useState<Pot | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [buyerCount, setBuyerCount] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [places, setPlaces] = useState("5");
  const [elimGames, setElimGames] = useState(String(gamesPerSquad));

  const load = useCallback(async () => {
    const { data: pots } = await supabase
      .from("side_pots").select("id, name, buy_in")
      .eq("tournament_id", tournamentId).eq("pot_type", "eliminator").limit(1);
    const p = (pots as Pot[])?.[0];
    setPot(p ?? null);
    if (!p) return;

    const { data: buys } = await supabase
      .from("side_pot_entries").select("entry_id").eq("side_pot_id", p.id);
    const ids = ((buys as { entry_id: string }[]) ?? []).map((b) => b.entry_id);
    setBuyerCount(ids.length);
    if (!ids.length) { setRows([]); return; }

    const [{ data: ents }, { data: games }, { data: cuts }] = await Promise.all([
      supabase.from("entries").select("id, entry_name").in("id", ids),
      supabase.from("games").select("entry_id, game_number, scratch_score").in("entry_id", ids),
      supabase.from("eliminator_cuts").select("entry_id, cut_after_game").eq("side_pot_id", p.id),
    ]);

    const cutMap: Record<string, number> = {};
    for (const c of (cuts as { entry_id: string; cut_after_game: number }[]) ?? []) {
      cutMap[c.entry_id] = c.cut_after_game;
    }
    const byEntry: Record<string, Record<number, number>> = {};
    for (const g of (games as { entry_id: string; game_number: number; scratch_score: number }[]) ?? []) {
      (byEntry[g.entry_id] ||= {})[g.game_number] =
        (byEntry[g.entry_id][g.game_number] ?? 0) + g.scratch_score;
    }

    const out: Row[] = ((ents as { id: string; entry_name: string }[]) ?? []).map((e) => {
      const sc = byEntry[e.id] ?? {};
      const cutAfter = cutMap[e.id] ?? null;
      const counted = Object.entries(sc)
        .filter(([n]) => cutAfter === null || Number(n) <= cutAfter)
        .reduce((s, [, v]) => s + v, 0);
      return { entryId: e.id, name: e.entry_name, scores: sc, total: counted, cutAfter };
    });

    out.sort((a, b) => {
      if (a.cutAfter === null && b.cutAfter !== null) return -1;
      if (a.cutAfter !== null && b.cutAfter === null) return 1;
      if (a.cutAfter !== b.cutAfter) return (b.cutAfter ?? 0) - (a.cutAfter ?? 0);
      return b.total - a.total;
    });
    setRows(out);
  }, [supabase, tournamentId]);

  useEffect(() => { load(); }, [load]);

  const alive = rows.filter((r) => r.cutAfter === null);
  const nextGame = Math.min(
    Math.max(1, Number(elimGames) || 1),
    Math.max(
      1,
      ...rows.map((r) => Object.keys(r.scores).map(Number).filter((n) => !isNaN(n)).length),
    ),
  );
  const gameCount = Math.max(1, Number(elimGames) || 1);
  const perGameCut = Math.floor(buyerCount / gameCount);
  const fund = buyerCount * Number(pot?.buy_in ?? 0);
  const placeCount = Math.max(1, Number(places) || 1);

  async function runCut() {
    if (!pot) return;
    const ranked = [...alive].sort((a, b) => {
      const av = a.scores[nextGame] ?? -1;
      const bv = b.scores[nextGame] ?? -1;
      return bv - av;
    });
    if (ranked.some((r) => (r.scores[nextGame] ?? -1) < 0)) {
      setMsg(`Every live bowler needs a game ${nextGame} score first.`);
      return;
    }
    const drop = ranked.slice(Math.max(1, ranked.length - perGameCut));
    if (!drop.length) { setMsg("Nobody to cut."); return; }
    if (!confirm(`Cut ${drop.length} bowlers after game ${nextGame}?`)) return;

    setBusy(true);
    const { error } = await supabase.from("eliminator_cuts").insert(
      drop.map((d) => ({
        tournament_id: tournamentId,
        side_pot_id: pot.id,
        entry_id: d.entryId,
        cut_after_game: nextGame,
      })),
    );
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(`Cut ${drop.length} after game ${nextGame}.`);
    load();
  }

  async function undoLastCut() {
    if (!pot) return;
    const last = Math.max(0, ...rows.map((r) => r.cutAfter ?? 0));
    if (!last) { setMsg("No cuts to undo."); return; }
    setBusy(true);
    const { error } = await supabase
      .from("eliminator_cuts").delete().eq("side_pot_id", pot.id).eq("cut_after_game", last);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(`Undid the game ${last} cut.`);
    load();
  }

  if (!pot) {
    return <p className="text-ink-soft text-sm">No eliminator pot on this tournament.</p>;
  }

  const cols = Array.from({ length: gameCount }, (_, i) => i + 1);
  const share = placeCount > 0 ? Math.round(fund / placeCount / 5) * 5 : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <span className="text-ink-soft text-sm">
          {alive.length} alive of {buyerCount} · fund {formatMoney(fund)} · cutting {perGameCut} per game
        </span>
        <label className="text-ink-soft flex flex-col text-xs">
          Games
          <input value={elimGames} onChange={(e) => setElimGames(e.target.value)}
            inputMode="numeric" className="glass-input mt-1 w-16 px-2 py-1 text-ink" />
        </label>
        <label className="text-ink-soft flex flex-col text-xs">
          Places paid
          <input value={places} onChange={(e) => setPlaces(e.target.value)}
            inputMode="numeric" className="glass-input mt-1 w-16 px-2 py-1 text-ink" />
        </label>
        <button onClick={runCut} disabled={busy || alive.length <= 1}
          className="rounded bg-[#B6FF2E] px-3 py-2 text-sm font-bold text-black disabled:opacity-40">
          Cut after game {nextGame}
        </button>
        <button onClick={undoLastCut} disabled={busy}
          className="rounded border border-white/20 px-3 py-2 text-sm text-white/70">
          Undo last cut
        </button>
      </div>

      <div className="space-y-1">
        {rows.map((r, i) => {
          const out = r.cutAfter !== null;
          const paid = !out && i < placeCount ? share : 0;
          return (
            <div key={r.entryId}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 ${out ? "bg-white/[0.03]" : "bg-white/5"}`}>
              <span className="text-ink-soft w-6 text-sm">{out ? "" : i + 1}</span>
              <span className={`min-w-0 flex-1 truncate text-sm ${out ? "text-ink-soft/50" : "text-ink"}`}>
                {r.name}
              </span>
              {cols.map((n) => (
                <span key={n}
                  className={`font-score w-11 text-center text-[13px] ${
                    out && r.cutAfter !== null && n > r.cutAfter
                      ? "text-ink-soft/20"
                      : out ? "text-ink-soft/50" : "text-ink"
                  }`}>
                  {r.scores[n] ?? "-"}
                </span>
              ))}
              <span className={`font-score w-14 text-right ${out ? "text-ink-soft/50" : "text-ink"}`}>
                {r.total}
              </span>
              <span className="font-score text-accent w-16 text-right text-sm">
                {out ? "elim" : paid > 0 ? formatMoney(paid) : ""}
              </span>
            </div>
          );
        })}
      </div>
      {msg && <p className="text-ink-soft mt-2 text-sm">{msg}</p>}
    </div>
  );
}
