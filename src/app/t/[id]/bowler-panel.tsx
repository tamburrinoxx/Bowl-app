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
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

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
        if (!cancelled) {
          const list = (games as MyGame[]) ?? [];
          setMyGames(list);
          const seeded: Record<number, string> = {};
          for (const g of list) seeded[g.game_number] = String(g.scratch_score);
          setDrafts(seeded);
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, tournamentId]);

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

  async function saveAll() {
    setBusy(true);
    setMessage(null);
    setIsError(false);

    const rows = Object.entries(drafts)
      .filter(([, v]) => v !== "" && !Number.isNaN(Number(v)))
      .map(([n, v]) => ({
        entry_id: entryId,
        bowler_id: userId,
        game_number: Number(n),
        scratch_score: Number(v),
      }));

    if (!rows.length) {
      setBusy(false);
      return;
    }

    const { error } = await supabase
      .from("games")
      .upsert(rows, { onConflict: "entry_id,bowler_id,game_number" });

    setBusy(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    const { data: games } = await supabase
      .from("games")
      .select("id, game_number, scratch_score")
      .eq("entry_id", entryId)
      .order("game_number");

    setMyGames((games as MyGame[]) ?? []);
    setMessage(`Saved ${rows.length} ${rows.length === 1 ? "game" : "games"}.`);
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

  const scratchTotal = Object.values(drafts).reduce(
    (sum, v) => sum + (v === "" || Number.isNaN(Number(v)) ? 0 : Number(v)),
    0,
  );
  const filled = Object.values(drafts).filter((v) => v !== "").length;

  return (
    <div className="glass-panel mb-6 p-8">
      <h2 className="font-display text-ink mb-4 text-xl">Your scores</h2>

      <div className="mb-4 flex flex-wrap gap-3">
        {Array.from({ length: gamesPerSquad }, (_, i) => i + 1).map((n) => {
          const posted = myGames.some((x) => x.game_number === n);
          return (
            <label key={n} className="block">
              <span className="text-ink-soft mb-1.5 block text-center text-xs">
                Game {n}
              </span>
              <input
                type="number"
                min={0}
                max={300}
                inputMode="numeric"
                value={drafts[n] ?? ""}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [n]: e.target.value }))
                }
                className={`glass-input font-score w-20 px-3 py-2.5 text-center text-xl text-ink ${
                  posted ? "ring-accent/40 ring-1" : ""
                }`}
              />
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={saveAll}
          disabled={busy || filled === 0}
          className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save scores"}
        </button>
        {filled > 0 && (
          <p className="text-ink-soft text-sm">
            Scratch total{" "}
            <span className="font-score text-ink">{scratchTotal}</span> across{" "}
            {filled} {filled === 1 ? "game" : "games"}.
          </p>
        )}
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${isError ? "text-red-400" : "text-ink-soft"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
