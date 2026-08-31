"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Team = { id: string; name: string; side: "A" | "B" };
type Match = {
  id: string;
  session_label: string;
  format: string;
  sort_order: number;
  side_a_label: string;
  side_b_label: string;
  score_a: number | null;
  score_b: number | null;
};

export default function RyderPanel({ tournamentId }: { tournamentId: string }) {
  const supabase = createClient();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameA, setNameA] = useState("Team Red");
  const [nameB, setNameB] = useState("Team Blue");
  const [mSession, setMSession] = useState("Session 1");
  const [mFormat, setMFormat] = useState("5-man Baker");
  const [mA, setMA] = useState("");
  const [mB, setMB] = useState("");

  async function createTeams() {
    setBusy(true);
    const { error } = await supabase.from("ryder_teams").insert([
      { tournament_id: tournamentId, name: nameA.trim() || "Team A", side: "A" },
      { tournament_id: tournamentId, name: nameB.trim() || "Team B", side: "B" },
    ]);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(null);
    load();
  }

  async function addMatch() {
    if (!mA.trim() || !mB.trim()) { setMsg("Both sides need a name."); return; }
    setBusy(true);
    const { error } = await supabase.from("ryder_matches").insert({
      tournament_id: tournamentId,
      session_label: mSession.trim() || "Session 1",
      format: mFormat,
      sort_order: matches.length + 1,
      side_a_label: mA.trim(),
      side_b_label: mB.trim(),
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMA(""); setMB(""); setMsg(null);
    load();
  }

  const load = useCallback(async () => {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from("ryder_teams").select("*").eq("tournament_id", tournamentId).order("side"),
      supabase.from("ryder_matches").select("*").eq("tournament_id", tournamentId).order("sort_order"),
    ]);
    setTeams((t as Team[]) ?? []);
    const rows = (m as Match[]) ?? [];
    setMatches(rows);
    const d: Record<string, string> = {};
    const l: Record<string, string> = {};
    for (const r of rows) {
      d[r.id + ":a"] = r.score_a == null ? "" : String(r.score_a);
      d[r.id + ":b"] = r.score_b == null ? "" : String(r.score_b);
      l[r.id + ":a"] = r.side_a_label;
      l[r.id + ":b"] = r.side_b_label;
    }
    setDrafts(d);
    setLabelDrafts(l);
  }, [supabase, tournamentId]);

  useEffect(() => { load(); }, [load]);

  function pointsFor(m: Match) {
    if (m.score_a == null || m.score_b == null) return [0, 0];
    if (m.score_a > m.score_b) return [1, 0];
    if (m.score_b > m.score_a) return [0, 1];
    return [0.5, 0.5];
  }

  const totalA = matches.reduce((s, m) => s + pointsFor(m)[0], 0);
  const totalB = matches.reduce((s, m) => s + pointsFor(m)[1], 0);
  const teamA = teams.find((t) => t.side === "A");
  const teamB = teams.find((t) => t.side === "B");

  async function renameTeam(id: string, name: string) {
    const clean = name.trim();
    if (!clean) return;
    await supabase.from("ryder_teams").update({ name: clean }).eq("id", id);
    load();
  }

  async function deleteMatch(id: string, label: string) {
    if (!confirm(`Delete ${label}?`)) return;
    setBusy(true);
    const { error } = await supabase.from("ryder_matches").delete().eq("id", id);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(null);
    load();
  }

  async function saveScores() {
    setBusy(true);
    for (const m of matches) {
      const a = drafts[m.id + ":a"];
      const b = drafts[m.id + ":b"];
      const na = a === "" ? null : Number(a);
      const nb = b === "" ? null : Number(b);
      const la = (labelDrafts[m.id + ":a"] ?? m.side_a_label).trim() || m.side_a_label;
      const lb = (labelDrafts[m.id + ":b"] ?? m.side_b_label).trim() || m.side_b_label;
      if (na === m.score_a && nb === m.score_b && la === m.side_a_label && lb === m.side_b_label) continue;
      const { error } = await supabase
        .from("ryder_matches")
        .update({ score_a: na, score_b: nb, side_a_label: la, side_b_label: lb })
        .eq("id", m.id);
      if (error) { setBusy(false); setMsg(error.message); return; }
    }
    setBusy(false);
    setMsg("Scores saved.");
    load();
  }

  if (teams.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-ink-soft text-sm">Name the two sides to start.</p>
        <div className="flex flex-wrap gap-2">
          <input value={nameA} onChange={(e) => setNameA(e.target.value)}
            className="glass-input px-3 py-2 text-ink" />
          <input value={nameB} onChange={(e) => setNameB(e.target.value)}
            className="glass-input px-3 py-2 text-ink" />
          <button onClick={createTeams} disabled={busy}
            className="rounded bg-[#B6FF2E] px-4 py-2 font-bold text-black disabled:opacity-40">
            Build Ryder Cup
          </button>
        </div>
        {msg && <p className="mt-1 text-sm text-red-400">{msg}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-around rounded-xl bg-black/20 p-4">
        <div className="text-center">
          <input
            defaultValue={teamA?.name ?? "Team A"}
            onBlur={(e) => teamA && renameTeam(teamA.id, e.target.value)}
            className="text-ink-soft w-28 bg-transparent text-center text-xs uppercase"
          />
          <p className="font-score text-accent text-4xl">{totalA}</p>
        </div>
        <span className="text-ink-soft">vs</span>
        <div className="text-center">
          <input
            defaultValue={teamB?.name ?? "Team B"}
            onBlur={(e) => teamB && renameTeam(teamB.id, e.target.value)}
            className="text-ink-soft w-28 bg-transparent text-center text-xs uppercase"
          />
          <p className="font-score text-accent text-4xl">{totalB}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-black/20 p-3">
        <input value={mSession} onChange={(e) => setMSession(e.target.value)}
          placeholder="Session" className="glass-input w-28 px-2 py-1.5 text-sm text-ink" />
        <select value={mFormat} onChange={(e) => setMFormat(e.target.value)}
          className="glass-input bg-transparent px-2 py-1.5 text-sm text-ink">
          <option>5-man Baker</option>
          <option>2-man Baker</option>
          <option>Scotch Doubles</option>
          <option>Singles</option>
        </select>
        <input value={mA} onChange={(e) => setMA(e.target.value)}
          placeholder="Side A" className="glass-input w-32 px-2 py-1.5 text-sm text-ink" />
        <input value={mB} onChange={(e) => setMB(e.target.value)}
          placeholder="Side B" className="glass-input w-32 px-2 py-1.5 text-sm text-ink" />
        <button onClick={addMatch} disabled={busy}
          className="rounded bg-[#B6FF2E] px-3 py-1.5 text-sm font-bold text-black disabled:opacity-40">
          Add match
        </button>
      </div>

      {matches.length === 0 ? (
        <p className="text-ink-soft text-sm">No matches yet.</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <div key={m.id} className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-ink-soft mb-1 flex items-center text-[11px] uppercase">
                {m.session_label} - {m.format}
                {(() => {
                  const ptsRow = pointsFor(m);
                  return m.score_a == null || m.score_b == null ? null : (
                    <span className="text-accent ml-2">
                      {ptsRow[0]} - {ptsRow[1]}
                    </span>
                  );
                })()}
                <button
                  onClick={() => deleteMatch(m.id, `${m.side_a_label} vs ${m.side_b_label}`)}
                  disabled={busy}
                  className="text-ink-soft ml-auto px-2 hover:text-red-400"
                  aria-label="Delete match"
                >
                  x
                </button>
              </p>
              <div className="flex items-center gap-2">
                <input value={labelDrafts[m.id + ":a"] ?? ""} onChange={(e) => setLabelDrafts((d) => ({ ...d, [m.id + ":a"]: e.target.value }))} className="glass-input min-w-0 flex-1 px-2 py-1 text-sm text-ink" />
                <input
                  inputMode="numeric"
                  value={drafts[m.id + ":a"] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [m.id + ":a"]: e.target.value }))}
                  className="glass-input w-14 px-2 py-1 text-center text-ink"
                />
                <input
                  inputMode="numeric"
                  value={drafts[m.id + ":b"] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [m.id + ":b"]: e.target.value }))}
                  className="glass-input w-14 px-2 py-1 text-center text-ink"
                />
                <input value={labelDrafts[m.id + ":b"] ?? ""} onChange={(e) => setLabelDrafts((d) => ({ ...d, [m.id + ":b"]: e.target.value }))} className="glass-input min-w-0 flex-1 px-2 py-1 text-right text-sm text-ink" />
              </div>
            </div>
          ))}
          <button
            onClick={saveScores}
            disabled={busy}
            className="mt-2 rounded bg-[#B6FF2E] px-4 py-2 font-bold text-black disabled:opacity-40"
          >
            Save scores
          </button>
        </div>
      )}
      {msg && <p className="text-ink-soft mt-2 text-sm">{msg}</p>}
    </div>
  );
}
