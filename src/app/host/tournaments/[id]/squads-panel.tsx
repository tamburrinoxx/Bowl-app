"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Entry } from "@/types";

type Squad = { id: string; label: string; starts_at: string | null; lane_range: string | null };

export default function SquadsPanel({
  tournamentId,
  entries,
}: {
  tournamentId: string;
  entries: Entry[];
}) {
  const supabase = createClient();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [label, setLabel] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [lanes, setLanes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("squads").select("id, label, starts_at, lane_range")
      .eq("tournament_id", tournamentId).order("starts_at");
    setSquads((data as Squad[]) ?? []);
  }, [supabase, tournamentId]);

  useEffect(() => { load(); }, [load]);

  async function addSquad() {
    if (!label.trim()) { setMsg("Give the squad a name."); return; }
    setBusy(true);
    const { error } = await supabase.from("squads").insert({
      tournament_id: tournamentId,
      label: label.trim(),
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      lane_range: lanes.trim() || null,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setLabel(""); setStartsAt(""); setLanes(""); setMsg(null);
    load();
  }

  async function removeSquad(id: string, name: string) {
    if (!confirm(`Delete ${name}? Entries in it become unassigned.`)) return;
    setBusy(true);
    await supabase.from("entries").update({ squad_id: null }).eq("squad_id", id);
    await supabase.from("squads").delete().eq("id", id);
    setBusy(false);
    load();
  }

  async function assign(entryId: string, squadId: string) {
    setBusy(true);
    const { error } = await supabase
      .from("entries").update({ squad_id: squadId || null }).eq("id", entryId);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    location.reload();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-black/20 p-3">
        <label className="text-ink-soft flex flex-col text-xs">
          Squad name
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="Squad A" className="glass-input mt-1 w-32 px-2 py-1.5 text-sm text-ink" />
        </label>
        <label className="text-ink-soft flex flex-col text-xs">
          Starts
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
            className="glass-input mt-1 px-2 py-1.5 text-sm text-ink" />
        </label>
        <label className="text-ink-soft flex flex-col text-xs">
          Lanes
          <input value={lanes} onChange={(e) => setLanes(e.target.value)}
            placeholder="1-24" className="glass-input mt-1 w-24 px-2 py-1.5 text-sm text-ink" />
        </label>
        <button onClick={addSquad} disabled={busy}
          className="rounded bg-[#B6FF2E] px-3 py-1.5 text-sm font-bold text-black disabled:opacity-40">
          Add squad
        </button>
      </div>

      {squads.length === 0 ? (
        <p className="text-ink-soft text-sm">No squads yet. Add one above.</p>
      ) : (
        <div className="space-y-4">
          {squads.map((sq) => {
            const mine = entries.filter((e) => e.squad_id === sq.id);
            return (
              <div key={sq.id} className="rounded-xl bg-white/5 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-ink font-medium">
                    {sq.label}
                    <span className="text-ink-soft ml-2 text-xs">
                      {sq.starts_at ? new Date(sq.starts_at).toLocaleString() : "no time"}
                      {sq.lane_range ? ` · lanes ${sq.lane_range}` : ""}
                      {` · ${mine.length} entries`}
                    </span>
                  </p>
                  <button onClick={() => removeSquad(sq.id, sq.label)}
                    className="text-ink-soft text-sm hover:text-red-400">x</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {mine.map((e) => (
                    <span key={e.id} className="text-ink rounded bg-white/5 px-2 py-0.5 text-xs">
                      {e.entry_name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {squads.length > 0 && (
        <div className="mt-4 rounded-xl bg-black/20 p-3">
          <p className="text-ink-soft mb-2 text-xs uppercase">Assign entries</p>
          <div className="space-y-1">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                <span className="text-ink min-w-0 flex-1 truncate text-sm">{e.entry_name}</span>
                <select
                  value={e.squad_id ?? ""}
                  onChange={(ev) => assign(e.id, ev.target.value)}
                  disabled={busy}
                  className="glass-input bg-transparent px-2 py-1 text-xs text-ink"
                >
                  <option value="">Unassigned</option>
                  {squads.map((sq) => (
                    <option key={sq.id} value={sq.id}>{sq.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && <p className="text-ink-soft mt-2 text-sm">{msg}</p>}
    </div>
  );
}
