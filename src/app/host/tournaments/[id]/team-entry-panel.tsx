"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Entry = {
  id: string;
  entry_name: string;
  squad_id: string | null;
  lane: number | null;
  locked_handicap: number | null;
};

type Squad = { id: string; label: string };
type GameRow = {
  id: string;
  entry_id: string;
  bowler_slot: number | null;
  game_number: number;
  scratch_score: number;
};

export default function TeamEntryPanel({
  tournamentId,
  entries,
  gamesPerSquad,
  bakerGames,
}: {
  tournamentId: string;
  entries: Entry[];
  gamesPerSquad: number;
  bakerGames: number;
}) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [squads, setSquads] = useState<Squad[]>([]);
  const [squadId, setSquadId] = useState<string>("all");
  const [roster, setRoster] = useState<Record<string, { slot: number; name: string }[]>>({});
  const [games, setGames] = useState<Record<string, GameRow>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const ids = useMemo(() => entries.map((e) => e.id), [entries]);

  const load = useCallback(async () => {
    const { data: sq } = await supabase
      .from("squads")
      .select("id,label,starts_at")
      .eq("tournament_id", tournamentId)
      .order("starts_at", { nullsFirst: false });
    const sqList = (sq ?? []) as Squad[];
    setSquads(sqList);
    setSquadId((cur) => (cur === "all" && sqList[0] ? sqList[0].id : cur));

    if (!ids.length) return;
    const [{ data: rb }, { data: gm }, { data: bk }] = await Promise.all([
      supabase.from("entry_bowlers").select("entry_id,position,name").in("entry_id", ids),
      supabase
        .from("games")
        .select("id,entry_id,bowler_slot,game_number,scratch_score")
        .in("entry_id", ids),
      supabase.from("baker_games").select("entry_id,game_number,score").in("entry_id", ids),
    ]);

    const rmap: Record<string, { slot: number; name: string }[]> = {};
    for (const r of (rb ?? []) as { entry_id: string; position: number; name: string | null }[]) {
      (rmap[r.entry_id] ||= []).push({ slot: r.position, name: r.name ?? `Bowler ${r.position}` });
    }
    setRoster(rmap);

    const gmap: Record<string, GameRow> = {};
    const d: Record<string, string> = {};
    for (const g of (gm ?? []) as GameRow[]) {
      const k = `g:${g.entry_id}:${g.bowler_slot ?? 1}:${g.game_number}`;
      gmap[k] = g;
      d[k] = String(g.scratch_score);
    }
    for (const b of (bk ?? []) as { entry_id: string; game_number: number; score: number }[]) {
      d[`b:${b.entry_id}:${b.game_number}`] = String(b.score);
    }
    setGames(gmap);
    setDrafts(d);
  }, [supabase, ids, tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveAll() {
    setSaving(true);
    setMsg(null);
    const inserts: Record<string, unknown>[] = [];
    const bakerRows: Record<string, unknown>[] = [];
    let updates = 0;

    for (const [k, v] of Object.entries(drafts)) {
      const n = Number(v);
      if (!v.trim() || Number.isNaN(n) || n < 0 || n > 300) continue;
      const parts = k.split(":");
      if (parts[0] === "b") {
        bakerRows.push({
          entry_id: parts[1],
          game_number: Number(parts[2]),
          score: n,
        });
      } else {
        const hit = games[k];
        if (hit) {
          if (hit.scratch_score !== n) {
            await supabase.from("games").update({ scratch_score: n }).eq("id", hit.id);
            updates++;
          }
        } else {
          inserts.push({
            entry_id: parts[1],
            bowler_slot: Number(parts[2]),
            game_number: Number(parts[3]),
            scratch_score: n,
          });
        }
      }
    }

    if (inserts.length) await supabase.from("games").insert(inserts);
    if (bakerRows.length) {
      await supabase
        .from("baker_games")
        .upsert(bakerRows, { onConflict: "entry_id,game_number" });
    }
    await load();
    setSaving(false);
    setMsg(`Saved ${inserts.length + updates} individual, ${bakerRows.length} Baker`);
  }

  const iCols = Array.from({ length: gamesPerSquad }, (_, i) => i + 1);
  const bCols = Array.from({ length: bakerGames }, (_, i) => i + 1);

  const shown = useMemo(() => {
    const list = squadId === "all" ? entries : entries.filter((e) => e.squad_id === squadId);
    return [...list].sort(
      (a, b) =>
        (a.lane ?? 9999) - (b.lane ?? 9999) || a.entry_name.localeCompare(b.entry_name)
    );
  }, [entries, squadId]);

  function filled(e: Entry) {
    const r = roster[e.id] ?? [];
    let n = 0;
    for (const b of r) for (const g of iCols) if (drafts[`g:${e.id}:${b.slot}:${g}`]?.trim()) n++;
    for (const g of bCols) if (drafts[`b:${e.id}:${g}`]?.trim()) n++;
    return n;
  }
  const needed = (e: Entry) => (roster[e.id]?.length ?? 3) * gamesPerSquad + bakerGames;
  const doneCount = shown.filter((e) => filled(e) >= needed(e)).length;

  function totals(e: Entry) {
    const r = roster[e.id] ?? [];
    let scratch = 0;
    for (const b of r)
      for (const g of iCols) scratch += Number(drafts[`g:${e.id}:${b.slot}:${g}`] || 0);
    for (const g of bCols) scratch += Number(drafts[`b:${e.id}:${g}`] || 0);
    const H = Math.round(Number(e.locked_handicap ?? 0));
    const hcpPins = gamesPerSquad * H + bakerGames * Math.round(H / 3);
    return { scratch, hcpPins, total: scratch + hcpPins };
  }

  const set = (k: string, v: string) => setDrafts((p) => ({ ...p, [k]: v }));
  const box =
    "w-12 rounded border border-white/30 bg-neutral-900 px-1 py-1 text-center text-sm font-semibold text-white tabular-nums";
  const pill = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-sm ${on ? "bg-[#B6FF2E] font-bold text-black" : "bg-white/5"}`;
  const [hideDone, setHideDone] = useState(false);
  const vis = hideDone ? shown.filter((e) => filled(e) < needed(e)) : shown;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {squads.map((s) => (<button key={s.id} onClick={() => setSquadId(s.id)} className={pill(squadId === s.id)}>{s.label}</button>))}
        <button onClick={() => setSquadId("all")} className={pill(squadId === "all")}>All</button>
        <button onClick={() => setHideDone((v) => !v)} className={pill(hideDone)}>Hide done</button>
        <span className="ml-auto text-sm opacity-70">{doneCount} of {shown.length} complete</span>
      </div>
      <div className="">
        {vis.map((e, idx) => {
          const r = [...(roster[e.id] ?? [])].sort((a, b) => a.slot - b.slot);
          const t = totals(e);
          const done = filled(e) >= needed(e);
          return (
            <div key={e.id} className={`my-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-l-4 px-3 py-2.5 ${idx % 2 ? "border-l-[#B6FF2E]/60 bg-white/[0.05]" : "border-l-white/25 bg-white/[0.02]"} ${done ? "opacity-50" : ""}`}>
              <div className="w-52 shrink-0 text-sm">
                <span className="font-score mr-2 text-white/70">{e.lane ?? "—"}</span>
                <span className="font-semibold">{e.entry_name}</span>
              </div>
              {r.map((b) => (
                <div key={b.slot} className="flex items-center gap-1">
                  <span className="w-24 truncate text-xs font-medium text-white/85">{b.name}</span>
                  {iCols.map((g) => (
                    <input key={g} inputMode="numeric" className={box} value={drafts[`g:${e.id}:${b.slot}:${g}`] ?? ""} onChange={(ev) => set(`g:${e.id}:${b.slot}:${g}`, ev.target.value)} />
                  ))}
                </div>
              ))}
              <div className="flex items-center gap-1">
                <span className="w-8 text-xs font-semibold uppercase text-white/70">Bkr</span>
                {bCols.map((g) => (
                  <input key={g} inputMode="numeric" className={box} value={drafts[`b:${e.id}:${g}`] ?? ""} onChange={(ev) => set(`b:${e.id}:${g}`, ev.target.value)} />
                ))}
              </div>
              <div className="ml-auto whitespace-nowrap text-right text-sm tabular-nums">
                <span className="text-white/60">{t.scratch}+{t.hcpPins}</span> <b>{t.total}</b>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-0 mt-3 flex items-center gap-3 bg-black/70 py-2 backdrop-blur">
        <button onClick={saveAll} disabled={saving} className="rounded-xl bg-[var(--flame)] px-5 py-2 font-semibold text-[var(--on-flame)] disabled:opacity-40">{saving ? "Saving..." : "Save all scores"}</button>
        {msg && <span className="text-sm opacity-70">{msg}</span>}
      </div>
    </div>
  );
}
