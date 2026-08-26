"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Entry } from "@/types";

interface ExistingGame {
  id: string;
  entry_id: string;
  game_number: number;
  scratch_score: number;
}

export default function ScoreEntryPanel({
  entries,
  gamesPerSquad,
}: {
  entries: Entry[];
  gamesPerSquad: number;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, ExistingGame>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set());

  const cols = Array.from({ length: gamesPerSquad }, (_, i) => i + 1);

  const load = useCallback(async () => {
    if (!entries.length) return;
    const { data } = await supabase
      .from("games")
      .select("id, entry_id, game_number, scratch_score")
      .in("entry_id", entries.map((e) => e.id));

    const byKey: Record<string, ExistingGame> = {};
    const seeded: Record<string, string> = {};
    for (const g of (data as ExistingGame[]) ?? []) {
      const key = `${g.entry_id}:${g.game_number}`;
      byKey[key] = g;
      seeded[key] = String(g.scratch_score);
    }
    setExisting(byKey);
    setDrafts(seeded);
  }, [supabase, entries]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveAll() {
    setSaving(true);
    setMessage(null);
    setIsError(false);

    const toInsert: { entry_id: string; game_number: number; scratch_score: number }[] = [];
    const toUpdate: { id: string; scratch_score: number }[] = [];

    for (const [key, raw] of Object.entries(drafts)) {
      if (raw === "" || Number.isNaN(Number(raw))) continue;
      const value = Number(raw);
      const prior = existing[key];
      if (prior) {
        if (prior.scratch_score !== value) {
          toUpdate.push({ id: prior.id, scratch_score: value });
        }
      } else {
        const [entryId, gameNumber] = key.split(":");
        toInsert.push({ entry_id: entryId, game_number: Number(gameNumber), scratch_score: value });
      }
    }

    if (!toInsert.length && !toUpdate.length) {
      setSaving(false);
      setMessage("Nothing changed.");
      return;
    }

    if (toInsert.length) {
      const { error } = await supabase.from("games").insert(toInsert);
      if (error) {
        setSaving(false);
        setIsError(true);
        setMessage(error.message);
        return;
      }
    }

    for (const u of toUpdate) {
      const { error } = await supabase
        .from("games")
        .update({ scratch_score: u.scratch_score })
        .eq("id", u.id);
      if (error) {
        setSaving(false);
        setIsError(true);
        setMessage(error.message);
        return;
      }
    }

    setSaving(false);
    const n = toInsert.length + toUpdate.length;

    // Flash the cells that just landed so it is obvious what was written.
    const touched = new Set<string>();
    for (const [key, raw] of Object.entries(drafts)) {
      if (raw !== "" && !Number.isNaN(Number(raw))) touched.add(key);
    }
    setJustSaved(touched);
    setTimeout(() => setJustSaved(new Set()), 1600);

    setMessage(`Saved ${n} ${n === 1 ? "score" : "scores"}.`);
    await load();
    router.refresh();
  }

  if (!entries.length) {
    return (
      <p className="text-ink-soft rounded-2xl bg-white/5 p-5 text-sm">
        Add entries before posting scores.
      </p>
    );
  }

  function rowTotal(entryId: string) {
    return cols.reduce((sum, n) => {
      const v = drafts[`${entryId}:${n}`];
      return sum + (v && !Number.isNaN(Number(v)) ? Number(v) : 0);
    }, 0);
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl bg-white/5">
        <table className="w-full text-left">
          <thead>
            <tr className="text-ink-soft text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Entry</th>
              {cols.map((n) => (
                <th key={n} className="px-2 py-3 text-center font-medium">G{n}</th>
              ))}
              <th className="text-accent px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-white/5">
                <td className="text-ink px-4 py-2 text-sm whitespace-nowrap">
                  {entry.entry_name}
                </td>
                {cols.map((n) => {
                  const key = `${entry.id}:${n}`;
                  return (
                    <td key={n} className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={300}
                        inputMode="numeric"
                        value={drafts[key] ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                        className={`glass-input font-score w-16 px-2 py-2 text-center transition-colors ${
                          justSaved.has(key)
                            ? "bg-accent text-on-accent ring-accent ring-2"
                            : existing[key]
                              ? "bg-accent/15 text-accent ring-accent/40 ring-1"
                              : drafts[key]
                                ? "text-ink ring-1 ring-white/30"
                                : "text-ink"
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="font-score text-accent px-4 py-2 text-right">
                  {rowTotal(entry.id) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save scores"}
        </button>
        <p className="text-ink-soft text-xs">
          Fill any cells and save. Lime-ringed boxes are already posted — retyping one overwrites it.
        </p>
      </div>

      {message && (
        <p className={`mt-3 text-sm ${isError ? "text-red-400" : "text-ink-soft"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
