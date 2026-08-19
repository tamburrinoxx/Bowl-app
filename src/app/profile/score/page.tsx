"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { FrameData } from "@/lib/bowling";
import { scoreGame, isFrameComplete, gameStats } from "@/lib/bowling";

function emptyGame(): FrameData[] {
  return Array.from({ length: 10 }, () => ({ rolls: [] }));
}

function FrameInputs({
  frame,
  frameNumber,
  onChange,
}: {
  frame: FrameData;
  frameNumber: number;
  onChange: (rolls: number[]) => void;
}) {
  const isTenth = frameNumber === 10;
  const r1 = frame.rolls[0];
  const r2 = frame.rolls[1];
  const r3 = frame.rolls[2];

  function setRoll(index: number, raw: string) {
    if (raw === "") {
      const rolls = frame.rolls.slice(0, index);
      onChange(rolls);
      return;
    }
    const val = Math.max(0, Math.min(10, Number(raw)));
    const rolls = frame.rolls.slice(0, index);
    rolls[index] = val;
    onChange(rolls);
  }

  const showRoll2 = isTenth ? r1 !== undefined : r1 !== undefined && r1 < 10;
  const showRoll3 =
    isTenth && r1 !== undefined && r2 !== undefined && (r1 === 10 || r1 + r2 === 10);

  const roll2Max = isTenth ? (r1 === 10 ? 10 : 10 - (r1 ?? 0)) : 10 - (r1 ?? 0);

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <span className="text-[10px] text-ink-soft">{frameNumber}</span>
      <div className="flex gap-1">
        <input
          type="number"
          min={0}
          max={10}
          value={r1 ?? ""}
          onChange={(e) => setRoll(0, e.target.value)}
          className="w-9 h-9 text-center glass-input text-ink text-sm"
        />
        {showRoll2 && (
          <input
            type="number"
            min={0}
            max={roll2Max}
            value={r2 ?? ""}
            onChange={(e) => setRoll(1, e.target.value)}
            className="w-9 h-9 text-center glass-input text-ink text-sm"
          />
        )}
        {showRoll3 && (
          <input
            type="number"
            min={0}
            max={10}
            value={r3 ?? ""}
            onChange={(e) => setRoll(2, e.target.value)}
            className="w-9 h-9 text-center glass-input text-ink text-sm"
          />
        )}
      </div>
    </div>
  );
}

export default function ScoreEntryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [label, setLabel] = useState("");
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [games, setGames] = useState<FrameData[][]>([emptyGame(), emptyGame(), emptyGame()]);
  const [activeGame, setActiveGame] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateFrame(gameIdx: number, frameIdx: number, rolls: number[]) {
    setGames((prev) => {
      const next = prev.map((g) => g.map((f) => ({ rolls: [...f.rolls] })));
      next[gameIdx][frameIdx] = { rolls };
      return next;
    });
  }

  const gameComplete = (g: FrameData[]) =>
    g.every((f, i) => isFrameComplete(f, i + 1));

  const allComplete = games.every(gameComplete);

  async function handleSave() {
    if (!label.trim()) {
      setError("Give this session a name (e.g. Tuesday League).");
      return;
    }
    if (!allComplete) {
      setError("Finish entering all 10 frames for each of the 3 games first.");
      return;
    }

    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      router.push("/profile");
      return;
    }

    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .insert({
        bowler_id: user.id,
        label: label.trim(),
        played_at: playedAt,
      })
      .select()
      .single();

    if (sessionErr || !session) {
      setError(sessionErr?.message ?? "Could not create session.");
      setSaving(false);
      return;
    }

    const rows = games.map((g, i) => ({
      session_id: session.id,
      game_number: i + 1,
      frame_data: g,
      scratch_score: scoreGame(g),
    }));

    const { error: gamesErr } = await supabase.from("session_games").insert(rows);

    setSaving(false);

    if (gamesErr) {
      setError(gamesErr.message);
      return;
    }

    router.push("/profile");
  }

  const currentGame = games[activeGame];
  const runningScore = gameComplete(currentGame) ? scoreGame(currentGame) : null;
  const stats = gameStats(currentGame);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <p className="font-score text-accent text-xs font-semibold tracking-wide mb-2 uppercase">
          Log a Session
        </p>
        <h1 className="font-display text-4xl text-ink mb-8">Enter Your Scores</h1>

        <div className="glass-panel p-8 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                Session name
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Tuesday League"
                className="glass-input w-full px-4 py-3 text-ink placeholder:text-ink-soft/60"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                Date
              </label>
              <input
                type="date"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                className="glass-input w-full px-4 py-3 text-ink"
              />
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            {[0, 1, 2].map((i) => {
              const complete = gameComplete(games[i]);
              return (
                <button
                  key={i}
                  onClick={() => setActiveGame(i)}
                  className={`pill-button px-5 py-2 text-sm ${
                    activeGame === i
                      ? "bg-accent text-on-accent"
                      : "bg-white/5 text-ink-soft"
                  }`}
                >
                  Game {i + 1} {complete ? "✓" : ""}
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2 min-w-max">
              {currentGame.map((frame, i) => (
                <FrameInputs
                  key={i}
                  frame={frame}
                  frameNumber={i + 1}
                  onChange={(rolls) => updateFrame(activeGame, i, rolls)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 mt-6 rounded-2xl bg-white/5 px-5 py-4">
            <div>
              <p className="text-xs text-ink-soft uppercase tracking-wide">Game Score</p>
              <p className="font-score text-2xl text-accent font-bold">
                {runningScore ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-soft uppercase tracking-wide">Strikes</p>
              <p className="font-score text-lg text-ink">{stats.strikes}</p>
            </div>
            <div>
              <p className="text-xs text-ink-soft uppercase tracking-wide">Spares</p>
              <p className="font-score text-lg text-ink">{stats.spares}</p>
            </div>
            <div>
              <p className="text-xs text-ink-soft uppercase tracking-wide">Opens</p>
              <p className="font-score text-lg text-ink">{stats.opens}</p>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-2xl p-4 mb-6">
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="pill-button w-full bg-accent text-on-accent text-base py-3.5 hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Session"}
        </button>
      </div>
    </main>
  );
}
