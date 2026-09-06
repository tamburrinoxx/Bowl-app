"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Entry } from "@/types";

export default function BakerPanel({
  tournamentId,
  entries,
  bakerGames,
}: {
  tournamentId: string;
  entries: Entry[];
  bakerGames: number;
}) {
  const supabase = createClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cols = Array.from({ length: bakerGames }, (_, i) => i + 1);

  const load = useCallback(async () => {
    if (!entries.length) return;
    const { data } = await supabase
      .from("baker_games").select("entry_id, game_number, score")
      .in("entry_id", entries.map((e) => e.id));
    const d: Record<string, string> = {};
    for (const r of (data as { entry_id: string; game_number: number; score: number | null }[]) ?? []) {
      d[`${r.entry_id}:${r.game_number}`] = r.score == null ? "" : String(r.score);
    }
    setDrafts(d);
  }, [supabase, entries]);

  useEffect(() => { load(); }, [load]);

  function totalFor(entryId: string) {
    return cols.reduce((sum, n) => {
      const v = drafts[`${entryId}:${n}`];
      return sum + (v && !Number.isNaN(Number(v)) ? Number(v) : 0);
    }, 0);
  }

  async function saveAll() {
    setBusy(true);
    const rows: { tournament_id: string; entry_id: string; game_number: number; score: number }[] = [];
    for (const [key, raw] of Object.entries(drafts)) {
      if (raw === "" || Number.isNaN(Number(raw))) continue;
      const val = Number(raw);
      if (val < 0 || val > 300) { setBusy(false); setMsg("Scores must be 0-300."); return; }
      const [entryId, gameNumber] = key.split(":");
      rows.push({ tournament_id: tournamentId, entry_id: entryId, game_number: Number(gameNumber), score: val });
    }
    const { error } = await supabase
      .from("baker_games").upsert(rows, { onConflict: "entry_id,game_number" });
    setBusy(false);
    setMsg(error ? error.message : "Baker scores saved.");
    if (!error) load();
  }

  if (bakerGames < 1) {
    return (
      <p className="text-ink-soft text-sm">
        No Baker games set for this tournament.
      </p>
    );
  }

  return (
    <div>
      <div className="text-ink-soft mb-1 flex items-center gap-2 px-3 text-[10px] uppercase">
        <span className="min-w-0 flex-1">Team</span>
        {cols.map((n) => (
          <span key={n} className="w-14 text-center">B{n}</span>
        ))}
        <span className="w-16 text-right">Total</span>
      </div>

      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5">
            <span className="text-ink min-w-0 flex-1 truncate text-sm">{e.entry_name}</span>
            {cols.map((n) => (
              <input
                key={n}
                inputMode="numeric"
                value={drafts[`${e.id}:${n}`] ?? ""}
                onChange={(ev) =>
                  setDrafts((d) => ({ ...d, [`${e.id}:${n}`]: ev.target.value }))
                }
                className="glass-input w-14 px-1 py-1 text-center text-sm text-ink"
              />
            ))}
            <span className="font-score text-accent w-16 text-right">{totalFor(e.id)}</span>
          </div>
        ))}
      </div>

      <button
        onClick={saveAll}
        disabled={busy}
        className="mt-3 rounded bg-[#B6FF2E] px-4 py-2 font-bold text-black disabled:opacity-40"
      >
        Save Baker scores
      </button>
      {msg && <p className="text-ink-soft mt-2 text-sm">{msg}</p>}
    </div>
  );
}
