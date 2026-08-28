"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { FrameData } from "@/lib/bowling";
import {
  scoreGame,
  isFrameComplete,
  gameStats,
  cumulativeScores,
  frameMarks,
} from "@/lib/bowling";

const ALL_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PIN_ROWS = [
  [7, 8, 9, 10],
  [4, 5, 6],
  [2, 3],
  [1],
];

function emptyGame(): FrameData[] {
  return Array.from({ length: 10 }, () => ({ rolls: [] }));
}

/** Which physical pins are still standing, given the pins knocked down on each roll so far this frame. */
function computeStandingPins(pinLog: number[][], frameNumber: number): number[] {
  let standing = [...ALL_PINS];
  const isTenth = frameNumber === 10;
  for (const knocked of pinLog) {
    standing = standing.filter((p) => !knocked.includes(p));
    if (standing.length === 0 && isTenth) {
      standing = [...ALL_PINS]; // fresh rack for a bonus ball
    }
  }
  return standing;
}

export default function ScoreEntryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [label, setLabel] = useState("");
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [games, setGames] = useState<FrameData[][]>([emptyGame(), emptyGame(), emptyGame()]);
  const [activeGame, setActiveGame] = useState(0);
  const [pinLog, setPinLog] = useState<number[][]>([]);
  // Which physical pins fell on each roll, kept per game and frame. The frame
  // scores only carry counts, so this is the only record of what was left.
  const [pinLogs, setPinLogs] = useState<number[][][][]>(() =>
    Array.from({ length: 3 }, () => Array.from({ length: 10 }, () => [])),
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [hitLogs, setHitLogs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentGame = games[activeGame];
  const currentFrameIndex = currentGame.findIndex((f, i) => !isFrameComplete(f, i + 1));
  const gameFinished = currentFrameIndex === -1;
  const frameNumber = currentFrameIndex + 1;

  const [hand, setHand] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("handedness")
        .eq("id", user.id)
        .maybeSingle();
      setHand(data?.handedness ?? "");
    })();
  }, []);

  useEffect(() => {
    setPinLog([]);
    setSelected(new Set());
  }, [activeGame, currentFrameIndex]);

  function updateFrame(gameIdx: number, frameIdx: number, rolls: number[]) {
    setGames((prev) => {
      const next = prev.map((g) => g.map((f) => ({ rolls: [...f.rolls] })));
      next[gameIdx][frameIdx] = { rolls };
      return next;
    });
  }

  function commitRoll(pins: number[]) {
    const newPinLog = [...pinLog, pins];
    setPinLog(newPinLog);
    setSelected(new Set());
    const newRolls = newPinLog.map((k) => k.length);
    updateFrame(activeGame, currentFrameIndex, newRolls);

    const gameIdx = activeGame;
    const frameIdx = currentFrameIndex;
    setPinLogs((prev) => {
      const next = prev.map((g) => g.map((f) => f.map((r) => [...r])));
      next[gameIdx][frameIdx] = newPinLog.map((r) => [...r]);
      return next;
    });
  }

  function togglePin(pin: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pin)) next.delete(pin);
      else next.add(pin);
      return next;
    });
  }

  const gameComplete = (g: FrameData[]) => g.every((f, i) => isFrameComplete(f, i + 1));
  const allComplete = games.every(gameComplete);

  const standingPins = gameFinished ? [] : computeStandingPins(pinLog, frameNumber);
  const canStrike = standingPins.length === 10;
  const cumulative = cumulativeScores(currentGame);
  const stats = gameStats(currentGame);
  const finalScore = gameComplete(currentGame) ? scoreGame(currentGame) : null;

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
      .insert({ bowler_id: user.id, label: label.trim(), played_at: playedAt })
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
      pin_log: pinLogs[i],
      hit_log: Object.fromEntries(Object.entries(hitLogs).filter(([k]) => k.startsWith(i + "-")).map(([k, v]) => [k.split("-")[1], v])),
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

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <p className="font-score text-accent text-xs font-semibold tracking-wide mb-2 uppercase">
          Log a Session
        </p>
        <h1 className="font-display text-4xl text-ink mb-8">Enter Your Scores</h1>

        <div className="glass-panel p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div className="flex gap-2 mb-4">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => setActiveGame(i)}
              className={`pill-button px-5 py-2 text-sm ${
                activeGame === i ? "bg-accent text-on-accent" : "bg-white/5 text-ink-soft"
              }`}
            >
              Game {i + 1} {gameComplete(games[i]) ? "✓" : ""}
            </button>
          ))}
        </div>

        {/* Scoresheet grid */}
        <div className="glass-panel p-4 mb-4">
          <div className="grid grid-cols-5">
            {currentGame.map((frame, i) => {
              const marks = frameMarks(frame, i + 1);
              const isActive = i === currentFrameIndex;
              return (
                <div
                  key={i}
                  className={`flex-1 min-w-[52px] border-r border-white/10 last:border-r-0 ${
                    isActive ? "bg-accent/10" : ""
                  }`}
                >
                  <p className="text-[12px] text-ink-soft text-center pt-1">{i + 1}</p>
                  <div className="flex justify-center gap-0.5 h-5 items-center">
                    {marks.length ? (
                      marks.map((m, j) => (
                        <span key={j} className="text-xs font-score text-ink">
                          {m}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-ink-soft/30">·</span>
                    )}
                  </div>
                  <p className="text-sm font-score text-accent text-center font-bold pb-1">
                    {cumulative[i] ?? ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pin deck */}
        <div className="glass-panel p-6 mb-4">
          {gameFinished ? (
            <div className="text-center py-8">
              <p className="text-ink-soft text-sm uppercase tracking-wide mb-1">Game Score</p>
              <p className="font-score text-4xl text-accent font-bold">{finalScore}</p>
            </div>
          ) : (
            <>
              <p className="text-center text-ink-soft text-xs uppercase tracking-wide mb-4">
                Frame {frameNumber} · Tap pins still standing
              </p>
              <div className="flex flex-col items-center gap-3 mb-6">
                {PIN_ROWS.map((row, ri) => (
                  <div key={ri} className="flex gap-3">
                    {row.map((pin) => {
                      const isAvailable = standingPins.includes(pin);
                      const isSelected = selected.has(pin);
                      return (
                        <button
                          key={pin}
                          disabled={!isAvailable}
                          onClick={() => togglePin(pin)}
                          className={`w-12 h-12 rounded-full text-sm font-semibold transition-colors ${
                            !isAvailable
                              ? "bg-white/5 text-ink-soft/20"
                              : isSelected
                              ? "bg-accent text-on-accent border-2 border-accent"
                              : "bg-white/10 text-ink hover:bg-white/15"
                          }`}
                        >
                          {pin}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

        {pinLog.length === 0 && (
          <div className="flex gap-2 mb-3">
            {(hand.includes("left") ? ["Miss L", "Light", "Pocket", "Heavy", "Miss R"] : ["Miss L", "Heavy", "Pocket", "Light", "Miss R"]).map((h) => {
              const hk = activeGame + "-" + currentFrameIndex;
              const on = hitLogs[hk] === h;
              return (
                <button
                  key={h}
                  onClick={() => setHitLogs((prev) => ({ ...prev, [hk]: prev[hk] === h ? "" : h }))}
                  className={"pill-button flex-1 py-2 text-xs " + (on ? "bg-accent text-on-accent" : "bg-white/10 text-ink-soft")}
                >
                  {h}
                </button>
              );
            })}
          </div>
        )}
              <div className="flex gap-3">
                {canStrike && (
                  <button
                    onClick={() => commitRoll(standingPins)}
                    className="pill-button flex-1 bg-accent text-on-accent py-3 hover:brightness-110"
                  >
                    Strike
                  </button>
                )}
                <button
                  onClick={() =>
                    commitRoll(standingPins.filter((p) => !selected.has(p)))
                  }
                  className="pill-button flex-1 bg-white/10 text-ink py-3 hover:bg-white/15"
                >
                  {pinLog.length === 0
                    ? "Next ball"
                    : selected.size === 0
                    ? "Spare"
                    : "Open"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-6 mb-6 rounded-2xl bg-white/5 px-5 py-4">
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
          <div className="flex-1 ml-4">
            <p className="text-xs text-ink-soft uppercase tracking-wide">Read</p>
            <p className="text-sm text-ink mt-1">
              {(() => {
                const tags = Object.entries(hitLogs)
                  .filter(([k, v]) => k.startsWith(activeGame + "-") && v)
                  .map(([, v]) => v);
                const recent = tags.slice(-4);
                if (recent.length < 2) return "Tag a few shots";
                const n = (t: string) => recent.filter((x) => x === t).length;
                const righty = !hand.includes("left");
                if (n("Heavy") >= 2) return righty ? "Playing heavy — move left" : "Playing heavy — move right";
                if (n("Light") >= 2) return righty ? "Coming in light — move right" : "Coming in light — move left";
                if (n("Miss R") >= 2) return "Missing right — check your target";
                if (n("Miss L") >= 2) return "Missing left — check your target";
                if (n("Pocket") >= 2) return "Pocket is dialed in";
                return "Mixed reaction — stay put";
              })()}
            </p>
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
