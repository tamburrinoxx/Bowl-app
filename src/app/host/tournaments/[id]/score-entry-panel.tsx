"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Entry } from "@/types";

export default function ScoreEntryPanel({
  entries,
  gamesPerSquad,
}: {
  entries: Entry[];
  gamesPerSquad: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [entryId, setEntryId] = useState(entries[0]?.id ?? "");
  const [gameNumber, setGameNumber] = useState(1);
  const [score, setScore] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!entryId || !score) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from("games").insert({
      entry_id: entryId,
      game_number: gameNumber,
      scratch_score: Number(score),
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Score posted.");
    setScore("");
    router.refresh();
  }

  if (!entries.length) {
    return (
      <p className="text-ink-soft text-sm rounded-2xl bg-white/50 p-5">
        Add entries before posting scores.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-4 rounded-2xl bg-white/50 p-5"
    >
      <label className="block">
        <span className="text-xs font-medium text-ink-soft block mb-1.5">Entry</span>
        <select
          value={entryId}
          onChange={(e) => setEntryId(e.target.value)}
          className="glass-input px-4 py-2.5 text-ink"
        >
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.entry_name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink-soft block mb-1.5">Game #</span>
        <select
          value={gameNumber}
          onChange={(e) => setGameNumber(Number(e.target.value))}
          className="glass-input px-4 py-2.5 text-ink"
        >
          {Array.from({ length: gamesPerSquad }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Game {n}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink-soft block mb-1.5">Score</span>
        <input
          type="number"
          min={0}
          max={300}
          required
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="glass-input w-24 font-score px-4 py-2.5 text-ink"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="pill-button bg-accent text-white px-6 py-2.5 hover:brightness-110 disabled:opacity-50"
      >
        {saving ? "Posting…" : "Post Score"}
      </button>

      {message && <span className="text-xs text-ink-soft">{message}</span>}
    </form>
  );
}
