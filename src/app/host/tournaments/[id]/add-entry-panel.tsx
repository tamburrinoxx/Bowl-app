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
  entrySize,
}: {
  tournamentId: string;
  eventType: EventType;
  handicapBase: number;
  handicapPercent: number;
  entrySize: number;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [entryName, setEntryName] = useState("");
  const [entryType, setEntryType] = useState<EntryType>(defaultTypeFor(eventType));
  const [average, setAverage] = useState("");
  const [override, setOverride] = useState("");
  const [bowlId, setBowlId] = useState("");
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [lookupBowlerId, setLookupBowlerId] = useState<string | null>(null);
  const [bowlId2, setBowlId2] = useState("");
  const [lookupNote2, setLookupNote2] = useState<string | null>(null);
  const [lookupBowlerId2, setLookupBowlerId2] = useState<string | null>(null);

  async function lookup2() {
    setLookupNote2(null);
    setLookupBowlerId2(null);
    const { data, error } = await supabase.rpc("lookup_bowler", { p_bowl_id: bowlId2.trim() });
    const hit = (data as { id: string; full_name: string; average: number; games_counted: number }[] | null)?.[0];
    if (error || !hit) { setLookupNote2("No bowler found for that Bowl ID."); return; }
    setLookupBowlerId2(hit.id);
    setLookupNote2(`${hit.full_name} linked as bowler 2.`);
  }
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const size = Math.max(1, entrySize ?? 1);
  const base = (handicapBase ?? 220) * size;
  const percent = handicapPercent ?? 0.9;
  const avgNum = average.trim() === "" ? null : Number(average);
  const computed =
    avgNum === null || Number.isNaN(avgNum)
      ? null
      : Math.max(0, Math.floor((base - avgNum) * percent));
  const effective =
    override.trim() === "" ? computed : Math.max(0, Math.floor(Number(override)));

  async function lookup() {
    if (!bowlId.trim()) return;
    setLookupNote(null);
    const { data, error } = await supabase.rpc("lookup_bowler", { p_bowl_id: bowlId.trim() });
    const hit = (data as { bowler_id: string; full_name: string; average: number; games_counted: number }[] | null)?.[0];
    if (error || !hit) {
      setLookupNote("No bowler with that ID.");
      setLookupBowlerId(null);
      return;
    }
    setEntryName(hit.full_name);
    setLookupBowlerId(hit.bowler_id);
    if (hit.games_counted > 0) {
      setAverage(String(hit.average));
      setLookupNote(`${hit.full_name} - ${hit.average} average across ${hit.games_counted} logged games.`);
    } else {
      setLookupNote(`${hit.full_name} - no logged games yet, enter an average.`);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!entryName.trim()) return;
    setSaving(true);
    setMessage(null);

    const { data: entry, error } = await supabase
      .from("entries")
      .insert({
        tournament_id: tournamentId,
        entry_name: entryName.trim(),
        entry_type: entryType,
        locked_average: avgNum,
        locked_handicap: effective,
      })
      .select("id")
      .single();

    // Link to a real profile when the entry came from a Bowl ID lookup, so the
    // result reaches their career page.
    if (!error && entry && lookupBowlerId) {
      await supabase.from("entry_bowlers").insert({
        entry_id: entry.id,
        bowler_id: lookupBowlerId,
        position: 1,
      });
    }
    if (!error && entry && lookupBowlerId2) {
      await supabase.from("entry_bowlers").insert({
        entry_id: entry.id,
        bowler_id: lookupBowlerId2,
        position: 2,
      });
    }

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(lookupBowlerId ? "Entry added and linked." : "Entry added.");
    setEntryName("");
    setAverage("");
    setOverride("");
    setBowlId("");
    setLookupBowlerId(null);
    setLookupNote(null);
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-4 rounded-2xl bg-white/5 p-5"
    >
      <label className="block">
        <span className="text-xs font-medium text-ink-soft block mb-1.5">
          Bowl ID
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={bowlId}
            onChange={(e) => setBowlId(e.target.value.toUpperCase())}
            placeholder="WZWU5G"
            className="glass-input font-score w-28 px-3 py-2.5 tracking-widest text-ink"
          />
          <button
            type="button"
            onClick={lookup}
            className="pill-button bg-white/8 text-ink px-4 py-2.5 text-xs hover:bg-white/12"
          >
            Look up
          </button>
        </div>
      </label>

      {entryType !== "single" && (
        <label className="block">
          <span className="text-ink-soft mb-1.5 block text-xs uppercase tracking-wide">
            Bowl ID - 2nd bowler
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={bowlId2}
              onChange={(e) => setBowlId2(e.target.value.toUpperCase())}
              placeholder="WZWU5G"
              className="glass-input font-score w-28 px-3 py-2.5 tracking-widest text-ink"
            />
            <button
              type="button"
              onClick={lookup2}
              className="pill-button bg-white/8 text-ink px-4 py-2.5 text-xs hover:bg-white/12"
            >
              Look up
            </button>
          </div>
          {lookupNote2 && <p className="text-accent mt-1 text-xs">{lookupNote2}</p>}
        </label>
      )}

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
          : `Auto handicap: ${computed} (${base} base${size > 1 ? ` for ${size} bowlers` : ""}, ${Math.round(percent * 100)}%). Type a value to override.`}
        {message ? ` · ${message}` : ""}
      </p>
      {lookupNote && <p className="text-accent w-full text-xs">{lookupNote}</p>}
    </form>
  );
}
