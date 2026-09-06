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
  const [bowlId3, setBowlId3] = useState("");
  const [memberNames, setMemberNames] = useState<string[]>(["", "", "", "", ""]);
  const [memberIds, setMemberIds] = useState<string[]>(["", "", "", "", ""]);
  const [memberAvgs, setMemberAvgs] = useState<string[]>(["", "", "", "", ""]);

  function setMember(list: string[], set: (v: string[]) => void, i: number, v: string) {
    const n = [...list];
    n[i] = v;
    set(n);
  }

  function fillMember(i: number, name: string) {
    setMemberNames((m) => {
      const n = [...m];
      n[i] = name;
      return n;
    });
  }
  const [lookupNote3, setLookupNote3] = useState<string | null>(null);
  const [lookupBowlerId3, setLookupBowlerId3] = useState<string | null>(null);

  async function lookup3() {
    setLookupNote3(null);
    setLookupBowlerId3(null);
    const { data, error } = await supabase.rpc("lookup_bowler", { p_bowl_id: bowlId3.trim() });
    const hit = (data as { id: string; full_name: string }[] | null)?.[0];
    if (error || !hit) { setLookupNote3("No bowler found for that Bowl ID."); return; }
    setLookupBowlerId3(hit.id);
    fillMember(2, hit.full_name);
    setLookupNote3(`${hit.full_name} linked as bowler 3.`);
  }
  const [lookupNote2, setLookupNote2] = useState<string | null>(null);
  const [lookupBowlerId2, setLookupBowlerId2] = useState<string | null>(null);

  async function lookup2() {
    setLookupNote2(null);
    setLookupBowlerId2(null);
    const { data, error } = await supabase.rpc("lookup_bowler", { p_bowl_id: bowlId2.trim() });
    const hit = (data as { id: string; full_name: string; average: number; games_counted: number }[] | null)?.[0];
    if (error || !hit) { setLookupNote2("No bowler found for that Bowl ID."); return; }
    setLookupBowlerId2(hit.id);
    fillMember(1, hit.full_name);
    setLookupNote2(`${hit.full_name} linked as bowler 2.`);
  }
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const size = Math.max(1, entrySize ?? 1);
  const base = (handicapBase ?? 220) * size;
  const percent = handicapPercent ?? 0.9;
  const memberAvgSum = memberAvgs
    .slice(0, size)
    .reduce((sum, v) => sum + (v.trim() && !Number.isNaN(Number(v)) ? Number(v) : 0), 0);
  const avgNum =
    average.trim() !== ""
      ? Number(average)
      : memberAvgSum > 0
        ? memberAvgSum
        : null;
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
    fillMember(0, hit.full_name);
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
    if (!error && entry) {
      const rows = memberNames.slice(0, size)
        .map((n, i) => ({ name: n.trim(), bid: (memberIds[i] ?? "").trim(), i }))
        .filter((r) => r.name)
        .map((r) => ({
          entry_id: entry.id,
          name: r.name,
          position: r.i + 1,
          bowler_id:
            r.i === 0 ? lookupBowlerId : r.i === 1 ? lookupBowlerId2 : r.i === 2 ? lookupBowlerId3 : null,
        }));
      if (rows.length) await supabase.from("entry_bowlers").insert(rows);
    }
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
    if (!error && entry && lookupBowlerId3) {
      await supabase.from("entry_bowlers").insert({
        entry_id: entry.id,
        bowler_id: lookupBowlerId3,
        position: 3,
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
      <div className="w-full">
        <span className="text-ink-soft mb-1.5 block text-xs uppercase tracking-wide">
          {size === 1 ? "Bowler" : "Team bowlers"}
        </span>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: size }, (_, i) => {
            const bid = memberIds[i] ?? "";
            return (
              <div key={i} className="flex w-40 flex-col gap-2 rounded-xl bg-black/20 p-3">
                <span className="text-ink-soft text-[10px] uppercase">Bowler {i + 1}</span>
                <div className="flex gap-1">
                  <input
                    value={bid}
                    onChange={(e) => setMember(memberIds, setMemberIds, i, e.target.value.toUpperCase())}
                    placeholder="Bowl ID"
                    className="glass-input font-score w-full px-2 py-1.5 text-xs tracking-widest text-ink"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!bid.trim()) return;
                      const { data } = await supabase.rpc("lookup_bowler", { p_bowl_id: bid.trim() });
                      const hit = (data as { id?: string; bowler_id?: string; full_name: string; average: number }[] | null)?.[0];
                      if (!hit) return;
                      setMember(memberNames, setMemberNames, i, hit.full_name);
                      setMember(memberAvgs, setMemberAvgs, i, String(hit.average));
                      const id = hit.id ?? hit.bowler_id ?? "";
                      if (i === 0) setLookupBowlerId(id);
                      if (i === 1) setLookupBowlerId2(id);
                      if (i === 2) setLookupBowlerId3(id);
                    }}
                    className="pill-button bg-white/8 text-ink shrink-0 px-2 text-[10px]"
                  >
                    Look
                  </button>
                </div>
                <input
                  value={memberNames[i] ?? ""}
                  onChange={(e) => setMember(memberNames, setMemberNames, i, e.target.value)}
                  placeholder="Name"
                  className="glass-input w-full px-2 py-1.5 text-sm text-ink"
                />
                <input
                  value={memberAvgs[i] ?? ""}
                  onChange={(e) => setMember(memberAvgs, setMemberAvgs, i, e.target.value)}
                  placeholder="Avg"
                  inputMode="numeric"
                  className="glass-input w-full px-2 py-1.5 text-sm text-ink"
                />
              </div>
            );
          })}
        </div>
      </div>

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
          max={300 * size}
          value={average || (memberAvgSum > 0 ? String(memberAvgSum) : "")}
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
