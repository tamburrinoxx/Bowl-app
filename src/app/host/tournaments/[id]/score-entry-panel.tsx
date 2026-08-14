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
      <p className="text-chalk/50 font-score text-sm border border-walnut-mid rounded-md p-4">
        Add entries before posting scores.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 border border-walnut-mid rounded-md p-4"
    >
      <label className="block">
        <span className="font-score text-xs uppercase text-chalk/60 block mb-1">Entry</span>
        <select
          value={entryId}
          onChange={(e) => setEntryId(e.target.value)}
          className="bg-walnut border border-walnut-mid rounded-md px-3 py-2 text-chalk"
        >
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.entry_name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="font-score text-xs uppercase text-chalk/60 block mb-1">Game #</span>
        <select
          value={gameNumber}
          onChange={(e) => setGameNumber(Number(e.target.value))}
          className="bg-walnut border border-walnut-mid rounded-md px-3 py-2 text-chalk"
        >
          {Array.from({ length: gamesPerSquad }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Game {n}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="font-score text-xs uppercase text-chalk/60 block mb-1">Score</span>
        <input
          type="number"
          min={0}
          max={300}
          required
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-24 font-score bg-walnut border border-walnut-mid rounded-md px-3 py-2 text-chalk"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="font-display bg-scoreboard-amber text-walnut px-5 py-2 rounded-md hover:brightness-110 disabled:opacity-50"
      >
        {saving ? "Posting…" : "Post Score"}
      </button>

      {message && <span className="font-score text-xs text-chalk/60">{message}</span>}
    </form>
  );
}
