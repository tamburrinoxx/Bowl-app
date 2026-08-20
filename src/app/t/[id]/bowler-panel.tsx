"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface MyGame {
  id: string;
  game_number: number;
  scratch_score: number;
}

export default function BowlerPanel({
  tournamentId,
  tournamentStatus,
  gamesPerSquad,
  handicapBase,
  handicapPercent,
}: {
  tournamentId: string;
  tournamentStatus: string;
  gamesPerSquad: number;
  handicapBase: number;
  handicapPercent: number;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [entryName, setEntryName] = useState("");
  const [myGames, setMyGames] = useState<MyGame[]>([]);
  const [average, setAverage] = useState("");
  const [score, setScore] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled && profile?.full_name) setEntryName(profile.full_name);

      const { data: links } = await supabase
        .from("entry_bowlers")
        .select("entry_id, entries!inner(id, tournament_id)")
        .eq("bowler_id", user.id);

      const mine = (links ?? []).find(
        (l: { entries?: { tournament_id?: string } }) =>
          l.entries?.tournament_id === tournamentId,
      ) as { entry_id: string } | undefined;

      if (cancelled) return;

      if (mine) {
        setEntryId(mine.entry_id);
        const { data: games } = await supabase
          .from("games")
          .select("id, game_number, scratch_score")
          .eq("entry_id", mine.entry_id)
          .order("game_number");
        if (!cancelled) setMyGames((games as MyGame[]) ?? []);
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, tournamentId]);

  const nextGame = myGames.length + 1;
  const avgNum = average.trim() === "" ? null : Number(average);
  const computedHandicap =
    avgNum === null || Number.isNaN(avgNum)
      ? 0
      : Math.max(0, Math.floor((handicapBase - avgNum) * handicapPercent));

  async function join() {
    if (!entryName.trim()) return;
    setBusy(true);
    setMessage(null);

    const { data: entry, error: eErr } = await supabase
      .from("entries")
      .insert({
        tournament_id: tournamentId,
        entry_name: entryName.trim(),
        entry_type: "single",
        locked_average: avgNum,
        locked_handicap: computedHandicap,
      })
      .select()
      .single();

    if (eErr || !entry) {
      setBusy(false);
      setMessage(eErr?.message ?? "Could not sign up.");
      return;
    }

    const { error: lErr } = await supabase.from("entry_bowlers").insert({
      entry_id: entry.id,
      bowler_id: userId,
      position: 1,
    });

    setBusy(false);

    if (lErr) {
      setMessage(`Entry created but linking failed: ${lErr.message}`);
      return;
    }

    setEntryId(entry.id);
    setMessage("You're in. Post your scores as you bowl.");
    router.refresh();
  }

  async function postScore() {
    if (!entryId || !score) return;
    setBusy(true);
    setMessage(null);

    const { data: game, error } = await supabase
      .from("games")
      .insert({
        entry_id: entryId,
        bowler_id: userId,
        game_number: nextGame,
        scratch_score: Number(score),
      })
      .select("id, game_number, scratch_score")
      .single();

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMyGames((g) => [...g, game as MyGame]);
    setScore("");
    setMessage(`Game ${nextGame} posted.`);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="glass-panel mb-6 p-8">
        <p className="text-ink-soft text-sm">Checking your entry…</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="glass-panel mb-6 flex items-center justify-between gap-4 p-8">
        <p className="text-ink-soft text-sm">
          Bowling in this? Sign in to enter and post your scores.
        </p>
        <Link
          href="/login"
          className="pill-button bg-accent text-on-accent shrink-0 px-5 py-2.5 text-sm hover:brightness-110"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const isOpen =
    tournamentStatus === "open" || tournamentStatus === "in_progress";

  if (!entryId) {
    if (!isOpen) {
      return (
        <div className="glass-panel mb-6 p-8">
          <p className="text-ink-soft text-sm">
            Signups aren&apos;t open yet — the host still has this one in{" "}
            {tournamentStatus.replace("_", " ")}.
          </p>
        </div>
      );
    }

    return (
      <div className="glass-panel mb-6 p-8">
        <h2 className="font-display text-ink mb-4 text-xl">Join this tournament</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="text-ink-soft mb-1.5 block text-xs font-medium">
              Your name
            </span>
            <input
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              className="glass-input px-4 py-2.5 text-ink"
            />
          </label>
          <label className="block">
            <span className="text-ink-soft mb-1.5 block text-xs font-medium">
              Your average
            </span>
            <input
              type="number"
              min={0}
              max={300}
              value={average}
              onChange={(e) => setAverage(e.target.value)}
              className="glass-input font-score w-24 px-4 py-2.5 text-ink"
            />
          </label>
          <button
            type="button"
            onClick={join}
            disabled={busy || !entryName.trim()}
            className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Joining…" : "Join"}
          </button>
        </div>
        <p className="text-ink-soft mt-3 text-xs">
          {avgNum === null
            ? `Handicap is ${handicapBase} base at ${Math.round(handicapPercent * 100)}% — enter your average and it locks in.`
            : `Your handicap: ${computedHandicap} per game. It locks now and won't move during the event.`}
          {message ? ` · ${message}` : ""}
        </p>
      </div>
    );
  }

  const scratchTotal = myGames.reduce((s, g) => s + g.scratch_score, 0);

  return (
    <div className="glass-panel mb-6 p-8">
      <h2 className="font-display text-ink mb-4 text-xl">Your scores</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {Array.from({ length: gamesPerSquad }, (_, i) => i + 1).map((n) => {
          const g = myGames.find((x) => x.game_number === n);
          return (
            <div
              key={n}
              className={`rounded-2xl px-5 py-3 text-center ${
                g ? "bg-accent/15" : "bg-white/5"
              }`}
            >
              <span className="text-ink-soft block text-xs">Game {n}</span>
              <span
                className={`font-score block text-2xl ${
                  g ? "text-accent" : "text-ink-soft"
                }`}
              >
                {g ? g.scratch_score : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {myGames.length > 0 && (
        <p className="text-ink-soft mb-4 text-sm">
          Scratch total{" "}
          <span className="font-score text-ink">{scratchTotal}</span> across{" "}
          {myGames.length} {myGames.length === 1 ? "game" : "games"}.
        </p>
      )}

      {nextGame <= gamesPerSquad ? (
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="text-ink-soft mb-1.5 block text-xs font-medium">
              Game {nextGame} score
            </span>
            <input
              type="number"
              min={0}
              max={300}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="glass-input font-score w-24 px-4 py-2.5 text-ink"
            />
          </label>
          <button
            type="button"
            onClick={postScore}
            disabled={busy || !score}
            className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      ) : (
        <p className="text-ink-soft text-sm">
          All {gamesPerSquad} games posted. You&apos;re done — watch the
          standings below.
        </p>
      )}

      {message && <p className="text-ink-soft mt-3 text-xs">{message}</p>}
    </div>
  );
}
