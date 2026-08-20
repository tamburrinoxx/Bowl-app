"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EntryType, EventType } from "@/types";

function defaultTypeFor(eventType: EventType): EntryType {
  if (eventType === "doubles") return "doubles";
  if (eventType === "team" || eventType === "baker") return "team";
  return "single";
}

export default function AddEntryPanel({
  tournamentId,
  eventType,
  handicapBase,
  handicapPercent,
}: {
  tournamentId: string;
  eventType: EventType;
  handicapBase: number;
  handicapPercent: number;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [entryName, setEntryName] = useState("");
  const [entryType, setEntryType] = useState<EntryType>(defaultTypeFor(eventType));
  const [average, setAverage] = useState("");
  const [override, setOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const base = handicapBase ?? 220;
  const percent = handicapPercent ?? 0.9;
  const avgNum = average.trim() === "" ? null : Number(average);
  const computed =
    avgNum === null || Number.isNaN(avgNum)
      ? null
      : Math.max(0, Math.floor((base - avgNum) * percent));
  const effective =
    override.trim() === "" ? computed : Math.max(0, Math.floor(Number(override)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!entryName.trim()) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from("entries").insert({
      tournament_id: tournamentId,
      entry_name: entryName.trim(),
      entry_type: entryType,
      locked_average: avgNum,
      locked_handicap: effective,
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Entry added.");
    setEntryName("");
    setAverage("");
    setOverride("");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-4 rounded-2xl bg-white/5 p-5"
    >
      <label className="block">
        <span className="text-xs font-medium text-ink-soft block mb-1.5">
          Bowler / team name
        </span>
        <input
          type="text"
          required
          value={entryName}
          onChange={(e) => setEntryName(e.target.value)}
          placeholder="Jane Doe"
          className="glass-input px-4 py-2.5 text-ink"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink-soft block mb-1.5">Type</span>
        <select
          value={entryType}
          onChange={(e) => setEntryType(e.target.value as EntryType)}
          className="glass-input px-4 py-2.5 text-ink"
        >
          <option value="single">Single</option>
          <option value="doubles">Doubles</option>
          <option value="team">Team</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink-soft block mb-1.5">Average</span>
        <input
          type="number"
          min={0}
          max={300}
          value={average}
          onChange={(e) => setAverage(e.target.value)}
          className="glass-input w-24 font-score px-4 py-2.5 text-ink"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-ink-soft block mb-1.5">
          Handicap
        </span>
        <input
          type="number"
          min={0}
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          placeholder={computed === null ? "auto" : String(computed)}
          className="glass-input w-24 font-score px-4 py-2.5 text-ink"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-50"
      >
        {saving ? "Adding…" : "Add Entry"}
      </button>

      <p className="text-ink-soft w-full text-xs">
        {computed === null
          ? `Handicap auto-calculates from average — ${base} base at ${Math.round(percent * 100)}%.`
          : `Auto handicap: ${computed} (${base} base, ${Math.round(percent * 100)}%). Type a value to override.`}
        {message ? ` · ${message}` : ""}
      </p>
    </form>
  );
}
