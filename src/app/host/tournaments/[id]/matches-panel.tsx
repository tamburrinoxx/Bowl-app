"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  generateBracket,
  generateStepladder,
  type SeededEntry,
} from "@/lib/brackets";

interface Stage {
  id: string;
  name: string;
  stage_type: string;
  advance_count: number | null;
  stage_number: number;
}

interface Match {
  id: string;
  stage_id: string;
  round_number: number;
  match_number: number;
  entry_a: string | null;
  entry_b: string | null;
  seed_a: number | null;
  seed_b: number | null;
  score_a: number | null;
  score_b: number | null;
  winner_entry_id: string | null;
  status: string;
}

export default function MatchesPanel({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [stages, setStages] = useState<Stage[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});

  const load = useCallback(async () => {
    const { data: st } = await supabase
      .from("tournament_stages")
      .select("id, name, stage_type, advance_count, stage_number")
      .eq("tournament_id", tournamentId)
      .in("stage_type", ["bracket", "stepladder"])
      .order("stage_number");

    const list = (st as Stage[]) ?? [];
    setStages(list);
    if (list.length && !activeStage) setActiveStage(list[0].id);

    const { data: ents } = await supabase
      .from("entries")
      .select("id, entry_name")
      .eq("tournament_id", tournamentId);

    const map: Record<string, string> = {};
    for (const e of (ents as { id: string; entry_name: string }[]) ?? []) {
      map[e.id] = e.entry_name;
    }
    setNames(map);

    const { data: ms } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("round_number")
      .order("match_number");

    setMatches((ms as Match[]) ?? []);
  }, [supabase, tournamentId, activeStage]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate(stage: Stage) {
    setBusy(true);
    setMessage(null);

    const { data: standings } = await supabase
      .from("standings")
      .select("entry_id, entry_name, handicap_total")
      .eq("tournament_id", tournamentId)
      .order("handicap_total", { ascending: false });

    const rows = (standings as { entry_id: string; entry_name: string }[]) ?? [];
    const take = stage.advance_count ?? rows.length;
    const seeded: SeededEntry[] = rows.slice(0, take).map((r, i) => ({
      entry_id: r.entry_id,
      entry_name: r.entry_name,
      seed: i + 1,
    }));

    if (seeded.length < 2) {
      setBusy(false);
      setMessage("Need at least two entries with scores before seeding.");
      return;
    }

    const generated =
      stage.stage_type === "stepladder"
        ? generateStepladder(seeded)
        : generateBracket(seeded);

    const { data: inserted, error } = await supabase
      .from("tournament_matches")
      .insert(
        generated.map((m) => ({
          tournament_id: tournamentId,
          stage_id: stage.id,
          round_number: m.round_number,
          match_number: m.match_number,
          entry_a: m.entry_a,
          entry_b: m.entry_b,
          seed_a: m.seed_a,
          seed_b: m.seed_b,
          winner_entry_id: m.winner_entry_id,
          status: m.status,
        })),
      )
      .select("id, round_number, match_number");

    if (error || !inserted) {
      setBusy(false);
      setMessage(error?.message ?? "Could not create matches.");
      return;
    }

    const idFor = new Map(
      (inserted as { id: string; round_number: number; match_number: number }[]).map(
        (r) => [`${r.round_number}-${r.match_number}`, r.id],
      ),
    );
    const keyToPos = new Map(
      generated.map((m) => [m.key, `${m.round_number}-${m.match_number}`]),
    );

    for (const m of generated) {
      if (!m.next_key) continue;
      const selfId = idFor.get(`${m.round_number}-${m.match_number}`);
      const nextPos = keyToPos.get(m.next_key);
      const nextId = nextPos ? idFor.get(nextPos) : null;
      if (!selfId || !nextId) continue;
      await supabase
        .from("tournament_matches")
        .update({ next_match_id: nextId, next_slot: m.next_slot })
        .eq("id", selfId);
    }

    setBusy(false);
    setMessage(`${generated.length} matches created.`);
    await load();
    router.refresh();
  }

  async function saveResult(m: Match) {
    const s = scores[m.id];
    if (!s || s.a === "" || s.b === "") return;

    const a = Number(s.a);
    const b = Number(s.b);
    if (a === b) {
      setMessage("Ties can't advance — bowl a rolloff or adjust a score.");
      return;
    }

    setBusy(true);
    setMessage(null);

    const winner = a > b ? m.entry_a : m.entry_b;

    const { error } = await supabase
      .from("tournament_matches")
      .update({
        score_a: a,
        score_b: b,
        winner_entry_id: winner,
        status: "complete",
      })
      .eq("id", m.id);

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${names[winner ?? ""] ?? "Winner"} advances.`);
    await load();
    router.refresh();
  }

  if (!stages.length) return null;

  const stage = stages.find((s) => s.id === activeStage) ?? stages[0];
  const shown = matches.filter((m) => m.stage_id === stage.id);
  const rounds = [...new Set(shown.map((m) => m.round_number))].sort(
    (x, y) => x - y,
  );

  return (
    <section className="glass-panel p-8 mb-6">
      <h2 className="font-display text-xl text-ink mb-4">{stage.name}</h2>

      {stages.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {stages.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveStage(s.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase ${
                s.id === stage.id
                  ? "bg-accent text-on-accent"
                  : "bg-white/5 text-ink-soft hover:bg-white/8"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div>
          <p className="text-ink-soft mb-4 text-sm">
            No matches yet. Seeding pulls the top{" "}
            {stage.advance_count ?? "all"} from current standings.
          </p>
          <button
            type="button"
            onClick={() => generate(stage)}
            disabled={busy}
            className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate matches"}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {rounds.map((r) => (
            <div key={r}>
              <p className="text-ink-soft mb-2 text-xs font-medium uppercase tracking-wide">
                Round {r}
              </p>
              <div className="space-y-2">
                {shown
                  .filter((m) => m.round_number === r)
                  .map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      names={names}
                      scores={scores}
                      setScores={setScores}
                      onSave={() => saveResult(m)}
                      busy={busy}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {message && <p className="text-ink-soft mt-4 text-xs">{message}</p>}
    </section>
  );
}

function MatchCard({
  match,
  names,
  scores,
  setScores,
  onSave,
  busy,
}: {
  match: Match;
  names: Record<string, string>;
  scores: Record<string, { a: string; b: string }>;
  setScores: (
    f: (
      s: Record<string, { a: string; b: string }>,
    ) => Record<string, { a: string; b: string }>,
  ) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const ready = match.entry_a && match.entry_b;
  const done = match.status === "complete";
  const s = scores[match.id] ?? { a: "", b: "" };

  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span
            className={
              done && match.winner_entry_id === match.entry_a
                ? "text-accent font-medium"
                : "text-ink"
            }
          >
            {match.seed_a ? `#${match.seed_a} ` : ""}
            {match.entry_a ? (names[match.entry_a] ?? "—") : "TBD"}
          </span>
          <span className="text-ink-soft mx-2">vs</span>
          <span
            className={
              done && match.winner_entry_id === match.entry_b
                ? "text-accent font-medium"
                : "text-ink"
            }
          >
            {match.seed_b ? `#${match.seed_b} ` : ""}
            {match.entry_b ? (names[match.entry_b] ?? "—") : "TBD"}
          </span>
        </div>

        {done ? (
          <span className="font-score text-accent text-sm">
            {match.score_a ?? "—"} – {match.score_b ?? "—"}
          </span>
        ) : ready ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={300}
              value={s.a}
              onChange={(e) =>
                setScores((prev) => ({
                  ...prev,
                  [match.id]: { ...s, a: e.target.value },
                }))
              }
              className="glass-input font-score w-20 px-3 py-2 text-ink"
            />
            <input
              type="number"
              min={0}
              max={300}
              value={s.b}
              onChange={(e) =>
                setScores((prev) => ({
                  ...prev,
                  [match.id]: { ...s, b: e.target.value },
                }))
              }
              className="glass-input font-score w-20 px-3 py-2 text-ink"
            />
            <button
              type="button"
              onClick={onSave}
              disabled={busy || s.a === "" || s.b === ""}
              className="pill-button bg-accent text-on-accent px-4 py-2 text-xs hover:brightness-110 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        ) : (
          <span className="text-ink-soft text-xs">Waiting on a winner</span>
        )}
      </div>
    </div>
  );
}
