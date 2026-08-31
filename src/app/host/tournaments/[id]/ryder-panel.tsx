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
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from("ryder_teams").select("*").eq("tournament_id", tournamentId).order("side"),
      supabase.from("ryder_matches").select("*").eq("tournament_id", tournamentId).order("sort_order"),
    ]);
    setTeams((t as Team[]) ?? []);
    const rows = (m as Match[]) ?? [];
    setMatches(rows);
    const d: Record<string, string> = {};
    for (const r of rows) {
      d[r.id + ":a"] = r.score_a == null ? "" : String(r.score_a);
      d[r.id + ":b"] = r.score_b == null ? "" : String(r.score_b);
    }
    setDrafts(d);
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

  async function saveScores() {
    setBusy(true);
    for (const m of matches) {
      const a = drafts[m.id + ":a"];
      const b = drafts[m.id + ":b"];
      const na = a === "" ? null : Number(a);
      const nb = b === "" ? null : Number(b);
      if (na === m.score_a && nb === m.score_b) continue;
      const { error } = await supabase
        .from("ryder_matches").update({ score_a: na, score_b: nb }).eq("id", m.id);
      if (error) { setBusy(false); setMsg(error.message); return; }
    }
    setBusy(false);
    setMsg("Scores saved.");
    load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-around rounded-xl bg-black/20 p-4">
        <div className="text-center">
          <p className="text-ink-soft text-xs uppercase">{teamA?.name ?? "Team A"}</p>
          <p className="font-score text-accent text-4xl">{totalA}</p>
        </div>
        <span className="text-ink-soft">vs</span>
        <div className="text-center">
          <p className="text-ink-soft text-xs uppercase">{teamB?.name ?? "Team B"}</p>
          <p className="font-score text-accent text-4xl">{totalB}</p>
        </div>
      </div>

      {matches.length === 0 ? (
        <p className="text-ink-soft text-sm">No matches yet.</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <div key={m.id} className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-ink-soft mb-1 text-[11px] uppercase">
                {m.session_label} - {m.format}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-ink flex-1 truncate text-sm">{m.side_a_label}</span>
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
                <span className="text-ink flex-1 truncate text-right text-sm">{m.side_b_label}</span>
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
