"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/payouts";

type Pot = { id: string; name: string; buy_in: number; scoring: string };
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
  const [cutCount, setCutCount] = useState("");
  const [sortGame, setSortGame] = useState<number | null>(null);

  const [pots, setPots] = useState<Pot[]>([]);
  const [potId, setPotId] = useState<string | null>(null);
  const [squads, setSquads] = useState<{ id: string; label: string }[]>([]);
  const [squadId, setSquadId] = useState<string>("all");

  const load = useCallback(async () => {
    const { data: potData } = await supabase
      .from("side_pots")
      .select("id, name, buy_in, scoring")
      .eq("tournament_id", tournamentId)
      .eq("pot_type", "eliminator")
      .order("sort_order");
    const list = (potData as Pot[]) ?? [];
    setPots(list);

    const { data: sqData } = await supabase
      .from("squads")
      .select("id,label,starts_at")
      .eq("tournament_id", tournamentId)
      .order("starts_at", { nullsFirst: false });
    setSquads((sqData ?? []) as { id: string; label: string }[]);
    const p = list.find((x) => x.id === potId) ?? list[0];
    setPot(p ?? null);
    if (!p) {
      setRows([]);
      setBuyerCount(0);
      return;
    }

    const { data: buys } = await supabase
      .from("side_pot_entries")
      .select("entry_id, bowler_slot")
      .eq("side_pot_id", p.id);
    const buyRows = (buys as { entry_id: string; bowler_slot: number | null }[]) ?? [];
    setBuyerCount(buyRows.length);
    if (!buyRows.length) {
      setRows([]);
      return;
    }

    const ids = [...new Set(buyRows.map((b) => b.entry_id))];

    const [{ data: ents }, { data: eb }, { data: games }, { data: cuts }] = await Promise.all([
      supabase.from("entries").select("id, entry_name, squad_id").in("id", ids),
      supabase.from("entry_bowlers").select("entry_id, position, name, handicap").in("entry_id", ids),
      supabase.from("games").select("entry_id, bowler_slot, game_number, scratch_score").in("entry_id", ids),
      supabase.from("eliminator_cuts").select("entry_id, bowler_slot, cut_after_game").eq("side_pot_id", p.id),
    ]);

    const nameOf = new Map<string, string>();
    const hcpOf = new Map<string, number>();
    for (const b of (eb as { entry_id: string; position: number; name: string | null; handicap: number | null }[]) ?? []) {
      const k = `${b.entry_id}:${b.position}`;
      nameOf.set(k, b.name ?? `Bowler ${b.position}`);
      hcpOf.set(k, Number(b.handicap ?? 0));
    }

    const cutMap: Record<string, number> = {};
    for (const c of (cuts as { entry_id: string; bowler_slot: number | null; cut_after_game: number }[]) ?? []) {
      cutMap[`${c.entry_id}:${c.bowler_slot ?? 1}`] = c.cut_after_game;
    }

    const useH = p.scoring === "handicap";
    const byKey: Record<string, Record<number, number>> = {};
    for (const g of (games as { entry_id: string; bowler_slot: number | null; game_number: number; scratch_score: number }[]) ?? []) {
      const k = `${g.entry_id}:${g.bowler_slot ?? 1}`;
      (byKey[k] ||= {})[g.game_number] = g.scratch_score + (useH ? hcpOf.get(k) ?? 0 : 0);
    }

    const entRows = (ents as { id: string; entry_name: string; squad_id: string | null }[]) ?? [];
    const squadOf = new Map(entRows.map((e) => [e.id, e.squad_id]));
    const teamOf = new Map(
      entRows.map((e) => [e.id, e.entry_name])
    );

    const out: Row[] = buyRows
      .filter((b) => squadId === "all" || squadOf.get(b.entry_id) === squadId)
      .map((b) => {
      const k = `${b.entry_id}:${b.bowler_slot ?? 1}`;
      const sc = byKey[k] ?? {};
      const cutAfter = cutMap[k] ?? null;
      const counted = Object.entries(sc)
        .filter(([n]) => cutAfter === null || Number(n) <= cutAfter)
        .reduce((s, [, v]) => s + v, 0);
      return {
        entryId: k,
        name: nameOf.get(k) ?? teamOf.get(b.entry_id) ?? "Bowler",
        scores: sc,
        total: counted,
        cutAfter,
      };
    });

    setBuyerCount(out.length);
    setRows(out);
  }, [supabase, tournamentId, potId, squadId]);

  useEffect(() => { load(); }, [load]);

  const alive = rows.filter((r) => r.cutAfter === null);
  const lastCut = Math.max(0, ...rows.map((r) => r.cutAfter ?? 0));
  const nextGame = Math.min(Math.max(1, Number(elimGames) || 1), lastCut + 1);
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
    const howMany = Number(cutCount) || perGameCut;
    if (howMany < 1 || howMany >= ranked.length) {
      setMsg(`Enter a number between 1 and ${ranked.length - 1}.`);
      return;
    }
    const drop = ranked.slice(ranked.length - howMany);
    const names = drop.map((d) => d.name).join(", ");
    if (!confirm(`Cut these ${drop.length} after game ${nextGame}?\n\n${names}`)) return;

    setBusy(true);
    const { error } = await supabase.from("eliminator_cuts").insert(
      drop.map((d) => ({
        tournament_id: tournamentId,
        side_pot_id: pot.id,
        entry_id: d.entryId.split(":")[0],
        bowler_slot: Number(d.entryId.split(":")[1]),
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
  const activeGame = sortGame ?? nextGame;
  const sortedRows = [...rows].sort((x, y) => {
    if (x.cutAfter === null && y.cutAfter !== null) return -1;
    if (x.cutAfter !== null && y.cutAfter === null) return 1;
    if (x.cutAfter !== y.cutAfter) return (y.cutAfter ?? 0) - (x.cutAfter ?? 0);
    const xv = x.scores[activeGame];
    const yv = y.scores[activeGame];
    if (xv != null || yv != null) return (yv ?? -1) - (xv ?? -1);
    return y.total - x.total;
  });
  const share = placeCount > 0 ? Math.round(fund / placeCount / 5) * 5 : 0;

  return (
    <div>
      {squads.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
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
      {pots.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pots.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setPotId(x.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                pot.id === x.id ? "bg-[#B6FF2E] font-bold text-black" : "bg-white/10"
              }`}
            >
              {x.name}
            </button>
          ))}
        </div>
      )}
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
          Cut how many
          <input value={cutCount} onChange={(e) => setCutCount(e.target.value)}
            inputMode="numeric" placeholder={String(perGameCut)}
            className="glass-input mt-1 w-20 px-2 py-1 text-ink" />
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

      <div className="text-ink-soft mb-1 flex items-center gap-2 px-3 text-[10px] uppercase">
        <span className="w-6" />
        <span className="min-w-0 flex-1">Bowler</span>
        {cols.map((n) => (
          <button key={n} onClick={() => setSortGame(n)}
            className={`w-11 text-center ${activeGame === n ? "text-accent" : ""}`}>
            G{n}
          </button>
        ))}
        <span className="w-14 text-right">Total</span>
        <span className="w-16 text-right">Prize</span>
      </div>

      <div className="space-y-1">
        {sortedRows.map((r, i) => {
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
                  className={`font-score w-11 text-center text-[13px] ${(() => {
                    const usedGame = n <= lastCut;
                    if (out) return n > (r.cutAfter ?? 0) ? "text-ink-soft/20" : "text-ink-soft/40";
                    if (usedGame) return "text-ink-soft/50";
                    if (n === nextGame) return "text-accent";
                    return "text-ink-soft/30";
                  })()}`}>
                  {r.scores[n] ?? "-"}
                </span>
              ))}
              <span className={`font-score w-14 text-right ${out ? "text-ink-soft/50" : "text-accent"}`}>
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
