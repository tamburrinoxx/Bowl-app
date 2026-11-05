"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { pointsFor } from "@/lib/ryder";

type Team = { id: string; name: string; side: "A" | "B"; color: string | null };
type Match = {
  id: string;
  session_label: string;
  format: string;
  sort_order: number;
  side_a_label: string;
  side_b_label: string;
  score_a: number | null;
  score_b: number | null;
  scores_a?: number[] | null;
  scores_b?: number[] | null;
  game_count?: number | null;
  tie_buffer?: number | null;
  lane?: string | null;
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
  const [mFormat, setMFormat] = useState("Singles");
  const [mA, setMA] = useState("");
  const [mB, setMB] = useState("");
  const [roster, setRoster] = useState<{ id: string; side: string; name: string }[]>([]);
  const [picksA, setPicksA] = useState<string[]>([]);
  const [picksB, setPicksB] = useState<string[]>([]);
  const [newA, setNewA] = useState("");
  const [newB, setNewB] = useState("");

  function sizeFor(fmt: string) {
    if (fmt === "Team Baker") return 5;
    if (fmt === "Singles") return 1;
    return 2;
  }

  async function addPlayer(side: "A" | "B", name: string) {
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    const { error } = await supabase.from("ryder_roster").insert({
      tournament_id: tournamentId, side, name: clean,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    if (side === "A") setNewA(""); else setNewB("");
    load();
  }

  async function removePlayer(id: string) {
    setBusy(true);
    await supabase.from("ryder_roster").delete().eq("id", id);
    setBusy(false);
    load();
  }

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
    const labelA = mA.trim();
    const labelB = mB.trim();
    if (!labelA || !labelB) { setMsg("Both sides need a name."); return; }
    setBusy(true);
    const { error } = await supabase.from("ryder_matches").insert({
      tournament_id: tournamentId,
      session_label: mSession.trim() || "Session 1",
      format: mFormat,
      game_count: mFormat === "Team Baker" ? 7 : 2,
      tie_buffer: 20,
      sort_order: matches.length + 1,
      side_a_label: labelA,
      side_b_label: labelB,
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

  function winColor(m: Match, side: "a" | "b") {
    const r = resultFor(m);
    const won = side === "a" ? r.a > r.b : r.b > r.a;
    if (!won) return undefined;
    return { color: side === "a" ? colorA : colorB, fontWeight: 700 };
  }

  function resultFor(m: Match) {
    return pointsFor(
      m.format,
      (m.scores_a ?? []) as number[],
      (m.scores_b ?? []) as number[],
      m.game_count ?? 2,
      m.tie_buffer ?? 20
    );
  }

  const totalA = matches.reduce((s, m) => s + resultFor(m).a, 0);
  const totalB = matches.reduce((s, m) => s + resultFor(m).b, 0);
  const teamA = teams.find((t) => t.side === "A");
  const teamB = teams.find((t) => t.side === "B");
  const colorA = teamA?.color ?? "#FF4D4D";
  const colorB = teamB?.color ?? "#4D8BFF";

  async function shareMatch(m: { share_token?: string; side_a_label: string; side_b_label: string }) {
    if (!m.share_token) { setMsg("No share link on this match yet."); return; }
    const url = `${window.location.origin}/m/${m.share_token}`;
    const text = `Score our match: ${m.side_a_label} vs ${m.side_b_label}\n${url}`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    setMsg("Link copied.");
  }

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
      const n = m.game_count ?? 2;
      const arr = (side: "a" | "b") =>
        Array.from({ length: n }, (_, i) => {
          const d = drafts[`${m.id}:${side}:${i}`];
          const cur = ((side === "a" ? m.scores_a : m.scores_b) ?? [])[i];
          const v = d === undefined ? cur : d === "" ? 0 : Number(d);
          return Number.isFinite(v) ? (v as number) : 0;
        });
      const la = (labelDrafts[m.id + ":a"] ?? m.side_a_label).trim() || m.side_a_label;
      const lb = (labelDrafts[m.id + ":b"] ?? m.side_b_label).trim() || m.side_b_label;
      const lane = labelDrafts[m.id + ":lane"] ?? m.lane ?? "";
      const { error } = await supabase
        .from("ryder_matches")
        .update({
          scores_a: arr("a"),
          scores_b: arr("b"),
          side_a_label: la,
          side_b_label: lb,
          lane: lane || null,
        })
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
          <option>Team Baker</option>
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
        {matches.length > 0 && (
          <button onClick={saveScores} disabled={busy}
            className="rounded bg-white/10 px-3 py-1.5 text-sm font-bold text-ink disabled:opacity-40">
            Save scores
          </button>
        )}
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
                  const r = resultFor(m);
                  return (
                    <span className={`ml-2 ${r.decided ? "text-accent" : "text-ink-soft/60"}`}>
                      {m.lane ? `Lane ${m.lane} · ` : ""}{r.a} - {r.b} · {r.note}
                    </span>
                  );
                })()}
                <button
                  onClick={() => shareMatch(m)}
                  className="text-accent ml-auto px-2 text-xs"
                >
                  Share
                </button>
                <button
                  onClick={() => deleteMatch(m.id, `${m.side_a_label} vs ${m.side_b_label}`)}
                  disabled={busy}
                  className="text-ink-soft px-2 hover:text-red-400"
                  aria-label="Delete match"
                >
                  x
                </button>
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-ink-soft w-10 shrink-0 text-[11px] uppercase">Lane</span>
                  <input
                    value={labelDrafts[m.id + ":lane"] ?? m.lane ?? ""}
                    onChange={(e) => setLabelDrafts((d) => ({ ...d, [m.id + ":lane"]: e.target.value }))}
                    placeholder="11/12"
                    className="glass-input w-20 px-2 py-1 text-center text-sm text-ink"
                  />
                </div>

                {(["a", "b"] as const).map((side) => (
                  <div key={side} className="flex items-center gap-1.5">
                    <input
                      value={labelDrafts[`${m.id}:${side}`] ?? ""}
                      onChange={(e) =>
                        setLabelDrafts((d) => ({ ...d, [`${m.id}:${side}`]: e.target.value }))
                      }
                      style={winColor(m, side)}
                      className={`glass-input min-w-0 flex-1 px-2 py-1 text-sm ${
                        (side === "a" ? resultFor(m).a > resultFor(m).b : resultFor(m).b > resultFor(m).a)
                          ? "text-accent font-bold"
                          : "text-ink"
                      }`}
                    />
                    {Array.from({ length: m.game_count ?? 2 }, (_, i) => (
                      <input
                        key={i}
                        inputMode="numeric"
                        value={
                          drafts[`${m.id}:${side}:${i}`] ??
                          String(((side === "a" ? m.scores_a : m.scores_b) ?? [])[i] ?? "")
                        }
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [`${m.id}:${side}:${i}`]: e.target.value }))
                        }
                        style={winColor(m, side)}
                        className="glass-input w-12 shrink-0 px-1 py-1 text-center text-sm text-ink"
                      />
                    ))}
                    <span className="font-score text-ink-soft w-12 shrink-0 text-right text-sm">
                      {((side === "a" ? m.scores_a : m.scores_b) ?? []).reduce((x, y) => x + (y || 0), 0) || "\u2014"}
                    </span>
                  </div>
                ))}
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
