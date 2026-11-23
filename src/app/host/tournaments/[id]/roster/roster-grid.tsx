"use client";

import { Fragment, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Entry = { id: string; entry_name: string; lane: number | null; paid: boolean | null; squad_id: string | null; locked_handicap: number | null; scratch_division: boolean };
type Squad = { id: string; label: string };
type Bowler = { id: string; entry_id: string; position: number; name: string | null; average: number | null; handicap: number | null };
type Pot = { id: string; name: string; pot_type: string; buy_in: number; scoring: string; participant: string; allow_multiple: boolean | null };
type Buy = { id: string; side_pot_id: string; entry_id: string; bowler_slot: number | null; quantity: number; paid: boolean | null };

export default function RosterGrid({
  base,
  percent,
  entryFee,
  scratchFee,
  entries,
  squads,
  bowlers,
  pots,
  buys,
}: {
  base: number;
  percent: number;
  entryFee: number;
  scratchFee: number;
  entries: Entry[];
  squads: Squad[];
  bowlers: Bowler[];
  pots: Pot[];
  buys: Buy[];
}) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  const pct = percent > 1 ? percent / 100 : percent;

  const [rows, setRows] = useState<Bowler[]>(bowlers);
  const [ents, setEnts] = useState<Entry[]>(entries);
  const [sold, setSold] = useState<Buy[]>(buys);
  const [squadId, setSquadId] = useState<string>("all");

  const bowlerPots = pots.filter((p) => p.participant !== "team");
  const teamPots = pots.filter((p) => p.participant === "team");

  const shown = useMemo(() => {
    const list = squadId === "all" ? ents : ents.filter((e) => e.squad_id === squadId);
    return [...list].sort(
      (a, b) => (a.lane ?? 9999) - (b.lane ?? 9999) || a.entry_name.localeCompare(b.entry_name)
    );
  }, [ents, squadId]);

  const byEntry = useMemo(() => {
    const m = new Map<string, Bowler[]>();
    for (const b of rows) {
      const arr = m.get(b.entry_id) ?? [];
      arr.push(b);
      m.set(b.entry_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.position - b.position);
    return m;
  }, [rows]);

  function buyOf(potId: string, entryId: string, slot: number | null) {
    return sold.find(
      (s) => s.side_pot_id === potId && s.entry_id === entryId && (s.bowler_slot ?? null) === slot
    );
  }

  async function setQty(pot: Pot, entryId: string, slot: number | null, qty: number) {
    const existing = buyOf(pot.id, entryId, slot);
    if (qty <= 0) {
      if (!existing) return;
      await supabase.from("side_pot_entries").delete().eq("id", existing.id);
      setSold((p) => p.filter((s) => s.id !== existing.id));
      return;
    }
    if (existing) {
      await supabase.from("side_pot_entries").update({ quantity: qty }).eq("id", existing.id);
      setSold((p) => p.map((s) => (s.id === existing.id ? { ...s, quantity: qty } : s)));
      return;
    }
    const { data } = await supabase
      .from("side_pot_entries")
      .insert({ side_pot_id: pot.id, entry_id: entryId, bowler_slot: slot, quantity: qty, paid: false })
      .select("id,side_pot_id,entry_id,bowler_slot,quantity,paid")
      .single();
    if (data) setSold((p) => [...p, data as Buy]);
  }

  async function saveBowler(b: Bowler, name: string, avg: string) {
    const a = Number(avg);
    const bad = !avg.trim() || Number.isNaN(a);
    const hcp = bad ? Number(b.handicap ?? 0) : Math.max(0, Math.round((base - a) * pct));
    const next: Bowler = {
      ...b,
      name: name.trim() || b.name,
      average: bad ? b.average : a,
      handicap: hcp,
    };
    setRows((p) => p.map((x) => (x.id === b.id ? next : x)));
    await supabase
      .from("entry_bowlers")
      .update({ name: next.name, average: next.average, handicap: next.handicap })
      .eq("id", b.id);
    const team = (byEntry.get(b.entry_id) ?? []).map((x) => (x.id === b.id ? next : x));
    const total = team.reduce((s, x) => s + Number(x.handicap ?? 0), 0);
    await supabase.from("entries").update({ locked_handicap: total }).eq("id", b.entry_id);
    setEnts((p) => p.map((e) => (e.id === b.entry_id ? { ...e, locked_handicap: total } : e)));
  }

  async function togglePaid(e: Entry) {
    const v = !e.paid;
    setEnts((p) => p.map((x) => (x.id === e.id ? { ...x, paid: v } : x)));
    await supabase.from("entries").update({ paid: v }).eq("id", e.id);
  }

  async function toggleScratch(e: Entry) {
    const v = !e.scratch_division;
    setEnts((p) => p.map((x) => (x.id === e.id ? { ...x, scratch_division: v } : x)));
    await supabase.from("entries").update({ scratch_division: v }).eq("id", e.id);
  }

  async function setLane(e: Entry, lane: string) {
    const n = Number(lane);
    const v = lane.trim() === "" || Number.isNaN(n) ? null : n;
    setEnts((p) => p.map((x) => (x.id === e.id ? { ...x, lane: v } : x)));
    await supabase.from("entries").update({ lane: v }).eq("id", e.id);
  }

  const cell = "px-2 py-1.5 text-sm";
  const input = "rounded border border-white/20 bg-neutral-900 px-2 py-1 text-sm text-white";
  const pill = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-sm ${on ? "bg-[#B6FF2E] font-bold text-black" : "bg-white/10"}`;

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap gap-2">
        {squads.map((s) => (
          <button key={s.id} type="button" onClick={() => setSquadId(s.id)} className={pill(squadId === s.id)}>
            {s.label}
          </button>
        ))}
        <button type="button" onClick={() => setSquadId("all")} className={pill(squadId === "all")}>
          All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="pin-checks w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/20 text-xs uppercase tracking-wide text-white/60">
              <th className={cell}>Bowler</th>
              <th className={cell}>Avg</th>
              <th className={cell}>Hdcp</th>
              <th className={cell}>Lane/Pos</th>
              {bowlerPots.map((p) => (
                <th key={p.id} className={`${cell} text-center`}>
                  {p.name}
                  <span className="block text-[10px] opacity-60">${p.buy_in}</span>
                </th>
              ))}
              <th className={`${cell} text-right`}>Owed</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => {
              const team = byEntry.get(e.id) ?? [];
              const owed = entryFee + (e.scratch_division ? scratchFee : 0) + sold
                .filter((s) => s.entry_id === e.id)
                .reduce((sum, s) => {
                  const p = pots.find((x) => x.id === s.side_pot_id);
                  return sum + (p ? Number(p.buy_in) * s.quantity : 0);
                }, 0);
              return (
                <Fragment key={e.id}>
                  <tr className="border-t-2 border-white/25 bg-white/[0.05]">
                    <td className={`${cell} font-semibold`} colSpan={3}>
                      {e.entry_name}
                    </td>
                    <td className={cell}>
                      <input
                        defaultValue={e.lane ?? ""}
                        placeholder="Lane"
                        onBlur={(ev) => setLane(e, ev.target.value)}
                        className={`${input} w-16`}
                      />
                    </td>
                    <td className={cell} colSpan={Math.max(1, bowlerPots.length)}>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={!!e.paid} onChange={() => togglePaid(e)} />
                          Entry paid
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={!!e.scratch_division}
                            onChange={() => toggleScratch(e)}
                          />
                          Scratch division
                        </label>
                        {teamPots.map((p) => (
                          <label key={p.id} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={!!buyOf(p.id, e.id, null)}
                              onChange={(ev) => setQty(p, e.id, null, ev.target.checked ? 1 : 0)}
                            />
                            {p.name} ${p.buy_in}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className={`${cell} text-right font-semibold`}>${owed}</td>
                  </tr>
                  {team.map((b) => (
                    <tr key={b.id} className="border-t border-white/10">
                      <td className={cell}>
                        <input
                          defaultValue={b.name ?? ""}
                          onBlur={(ev) => saveBowler(b, ev.target.value, String(b.average ?? ""))}
                          className={`${input} w-48`}
                        />
                      </td>
                      <td className={cell}>
                        <input
                          defaultValue={b.average ?? ""}
                          inputMode="numeric"
                          onBlur={(ev) => saveBowler(b, b.name ?? "", ev.target.value)}
                          className={`${input} w-20`}
                        />
                      </td>
                      <td className={`${cell} tabular-nums`}>{b.handicap ?? 0}</td>
                      <td className={`${cell} tabular-nums opacity-70`}>
                        {e.lane ?? "—"}/{b.position}
                      </td>
                      {bowlerPots.map((p) => {
                        const hit = buyOf(p.id, e.id, b.position);
                        return (
                          <td key={p.id} className={`${cell} text-center`}>
                            {p.allow_multiple ? (
                              <input
                                type="number"
                                min={0}
                                defaultValue={hit?.quantity ?? 0}
                                onBlur={(ev) => setQty(p, e.id, b.position, Number(ev.target.value))}
                                className={`${input} w-14 text-center`}
                              />
                            ) : (
                              <input
                                type="checkbox"
                                checked={!!hit}
                                onChange={(ev) => setQty(p, e.id, b.position, ev.target.checked ? 1 : 0)}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className={cell}></td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}