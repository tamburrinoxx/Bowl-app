"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/payouts";
import { analysePinLogs, type BowlingStats } from "@/lib/leaves";
import { BADGES } from "@/lib/achievements";
import { StatRow } from "@/components/stat-row";

interface TournamentRow {
  id: string;
  name: string;
  centerName: string | null;
  date: string | null;
  position: number;
  fieldSize: number;
  scratchTotal: number;
  games: number;
  winnings: number;
}

export default function CareerView() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [stats, setStats] = useState<BowlingStats | null>(null);
  const [sessionGames, setSessionGames] = useState(0);
  const [allGames, setAllGames] = useState<{ log: number[][][]; leagueId: string | null; score: number; gameNumber: number; sessionId: string; playedAt: string }[]>([]);
  const [leagueOpts, setLeagueOpts] = useState<{ id: string; name: string }[]>([]);
  const [useLeagues, setUseLeagues] = useState(true);
  const [useOpen, setUseOpen] = useState(true);
  const [drill, setDrill] = useState<null | "games" | "series">(null);
  const [badges, setBadges] = useState<{ code: string; earned_at: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: a } = await supabase.auth.getUser();
      if (!a.user) return;
      const { data } = await supabase
        .from("achievements")
        .select("code, earned_at")
        .eq("bowler_id", a.user.id)
        .order("earned_at", { ascending: false });
      setBadges((data as { code: string; earned_at: string }[]) ?? []);
    })();
  }, [supabase]);

  const picked = allGames.filter((g) => (g.leagueId ? useLeagues : useOpen));

  useEffect(() => {
    setStats(picked.length ? analysePinLogs(picked.map((g) => g.log)) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useLeagues, useOpen, allGames]);

  const gameStats = (() => {
    if (!picked.length) return null;
    const scores = picked.map((g) => g.score);
    const totalPins = scores.reduce((a, b) => a + b, 0);
    const high = Math.max(...scores);
    const highCount = scores.filter((x) => x === high).length;

    const bySession: Record<string, { score: number; at: string }> = {};
    for (const g of picked) {
      bySession[g.sessionId] ||= { score: 0, at: g.playedAt };
      bySession[g.sessionId].score += g.score;
    }
    const seriesList = Object.values(bySession).sort((a, b) => b.score - a.score);

    const cleanGames = picked.filter((g) => {
      const a = analysePinLogs([g.log]);
      return a.frames > 0 && a.opens === 0;
    }).length;

    return {
      games: picked.length,
      average: (totalPins / picked.length).toFixed(2),
      high, highCount, totalPins, cleanGames,
      highSeries: seriesList[0]?.score ?? 0,
      seriesList,
      scores: picked.map((g) => ({ score: g.score, at: g.playedAt })).sort((a, b) => b.score - a.score),
    };
  })();

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setSignedIn(false);
      setLoading(false);
      return;
    }
    setSignedIn(true);

    const { data: links } = await supabase
      .from("entry_bowlers")
      .select("entry_id")
      .eq("bowler_id", user.id);

    const entryIds = (links as { entry_id: string }[])?.map((l) => l.entry_id) ?? [];

    if (entryIds.length) {
      const { data: entries } = await supabase
        .from("entries")
        .select("id, tournament_id")
        .in("id", entryIds);

      const entryList = (entries as { id: string; tournament_id: string }[]) ?? [];
      const tIds = [...new Set(entryList.map((e) => e.tournament_id))];

      const { data: tournaments } = await supabase
        .from("tournaments")
        .select("id, name, center_name, starts_at")
        .in("id", tIds);

      const { data: standings } = await supabase
        .from("standings")
        .select("entry_id, tournament_id, handicap_total, scratch_total, games_played")
        .in("tournament_id", tIds)
        .order("handicap_total", { ascending: false });

      const { data: payouts } = await supabase
        .from("tournament_payouts")
        .select("tournament_id, position, amount")
        .in("tournament_id", tIds);

      const standList = (standings as { entry_id: string; tournament_id: string; scratch_total: number; games_played: number }[]) ?? [];
      const payList = (payouts as { tournament_id: string; position: number; amount: number }[]) ?? [];
      const tourList = (tournaments as { id: string; name: string; center_name: string | null; starts_at: string | null }[]) ?? [];

      const built: TournamentRow[] = [];
      for (const t of tourList) {
        const field = standList.filter((s) => s.tournament_id === t.id);
        const myEntry = entryList.find((e) => e.tournament_id === t.id);
        const idx = field.findIndex((s) => s.entry_id === myEntry?.id);
        if (idx < 0) continue;
        const mine = field[idx];
        const pay = payList.find((p) => p.tournament_id === t.id && p.position === idx + 1)?.amount ?? 0;
        built.push({
          id: t.id,
          name: t.name,
          centerName: t.center_name,
          date: t.starts_at,
          position: idx + 1,
          fieldSize: field.length,
          scratchTotal: mine.scratch_total,
          games: mine.games_played,
          winnings: Number(pay),
        });
      }

      built.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
      setRows(built);
    }

    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, label, league_id, played_at")
      .eq("bowler_id", user.id);

    const sessList = (sessions as { id: string; label: string; league_id: string | null; played_at: string }[]) ?? [];
    const sessionIds = sessList.map((s) => s.id);

    if (sessionIds.length) {
      const { data: lg } = await supabase
        .from("leagues").select("id, name")
        .in("id", sessList.map((x) => x.league_id).filter(Boolean) as string[]);
      setLeagueOpts((lg as { id: string; name: string }[]) ?? []);

      const { data: sg } = await supabase
        .from("session_games")
        .select("pin_log, session_id, scratch_score, game_number")
        .in("session_id", sessionIds)
        .not("pin_log", "is", null);

      const raw = (sg as { pin_log: number[][][]; session_id: string; scratch_score: number; game_number: number }[]) ?? [];
      const tagged = raw.map((r) => {
        const sess = sessList.find((x) => x.id === r.session_id);
        return {
          log: r.pin_log,
          leagueId: sess?.league_id ?? null,
          score: r.scratch_score,
          gameNumber: r.game_number,
          sessionId: r.session_id,
          playedAt: sess?.played_at ?? "",
        };
      });
      setAllGames(tagged);
      setSessionGames(tagged.length);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="glass-panel text-ink-soft p-8 text-sm">Loading…</p>;
  }

  if (!signedIn) {
    return (
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 p-8">
        <p className="text-ink-soft text-sm">Sign in to see your career.</p>
        <Link href="/login" className="pill-button bg-accent text-on-accent px-5 py-2.5 text-sm">
          Sign in
        </Link>
      </div>
    );
  }

  const totalGames = rows.reduce((s, r) => s + r.games, 0);
  const totalPins = rows.reduce((s, r) => s + r.scratchTotal, 0);
  const average = totalGames ? Math.round(totalPins / totalGames) : 0;
  const winnings = rows.reduce((s, r) => s + r.winnings, 0);
  const wins = rows.filter((r) => r.position === 1).length;
  const cashes = rows.filter((r) => r.winnings > 0).length;
  const best = rows.length ? Math.min(...rows.map((r) => r.position)) : 0;

  return (
    <div className="space-y-6">
      <div className="glass-panel p-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Tournament avg" value={average || "—"} />
          <Stat label="Events" value={rows.length} />
          <Stat label="Won" value={wins} />
          <Stat label="Winnings" value={formatMoney(winnings)} />
        </div>
        {rows.length > 0 && (
          <p className="text-ink-soft mt-4 text-xs">
            Best finish {ordinal(best)} · cashed {cashes} of {rows.length} · {totalGames} games bowled
          </p>
        )}
      </div>

      {drill && gameStats && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#1f2329]">
          <div className="sticky top-0 flex items-center gap-2 border-b border-white/10 bg-[#1f2329] px-4 py-3">
            <button onClick={() => setDrill(null)} className="text-accent text-sm">
              ‹ Back
            </button>
            <span className="text-ink mx-auto pr-10 text-sm font-semibold">
              {drill === "games" ? "All games" : "All 3-game series"}
            </span>
          </div>
          <div className="mx-auto max-w-2xl">
            {(drill === "games" ? gameStats.scores : gameStats.seriesList).map((r, i) => (
              <div key={i} className="flex items-center justify-between border-b border-white/5 px-5 py-3">
                <span className="text-ink-soft text-sm">
                  {r.at ? new Date(r.at).toLocaleDateString() : "—"}
                </span>
                <span className="font-score text-ink text-lg">{r.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {gameStats && (
        <div className="glass-panel mb-6 overflow-hidden p-0">
          <p className="text-ink-soft px-4 pb-2 pt-4 text-xs font-medium uppercase tracking-wide">
            Game statistics
          </p>
          <StatRow label="Average" value={`${gameStats.average} (${gameStats.games} games)`}
            onClick={() => setDrill("games")} />
          <StatRow label="High game" value={`${gameStats.high}${gameStats.highCount > 1 ? ` (x${gameStats.highCount})` : ""}`}
            onClick={() => setDrill("games")} />
          <StatRow label="Clean games" value={String(gameStats.cleanGames)} />
          <StatRow label="High 3-game series" value={String(gameStats.highSeries)}
            onClick={() => setDrill("series")} />
          <StatRow label="Total pins" value={String(gameStats.totalPins)} />
        </div>
      )}

      {badges.length > 0 && (
        <div className="glass-panel mb-6 p-5 sm:p-8">
          <p className="text-ink-soft mb-4 text-xs font-medium uppercase tracking-wide">
            Achievements
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              badges.reduce<Record<string, number>>((acc, b) => {
                acc[b.code] = (acc[b.code] ?? 0) + 1;
                return acc;
              }, {})
            ).map(([code, n]) => (
              <div key={code} className="rounded-2xl bg-white/5 px-3 py-2">
                <p className="text-accent text-sm font-semibold">
                  {BADGES[code]?.name ?? code}
                  {n > 1 && <span className="text-ink-soft ml-1 text-xs">×{n}</span>}
                </p>
                <p className="text-ink-soft text-[11px]">{BADGES[code]?.blurb ?? ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats && (
        <div className="glass-panel p-8">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <p className="text-ink-soft text-xs font-medium uppercase tracking-wide">
              All time · {stats.frames} frames
            </p>
            <span className="flex gap-2">
              {[
                { label: "Leagues", on: useLeagues, set: setUseLeagues },
                { label: "Open", on: useOpen, set: setUseOpen },
              ].map((c) => (
                <button key={c.label} onClick={() => c.set(!c.on)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    c.on ? "bg-accent text-on-accent" : "text-ink-soft bg-white/5"
                  }`}>
                  {c.label}
                </button>
              ))}
            </span>
          </div>
          <div className="mb-6 grid grid-cols-3 gap-6">
            <Stat label="Strikes" value={`${stats.strikePct}%`} />
            <Stat label="Spares" value={`${stats.sparePct}%`} />
            <Stat label="Opens" value={stats.opens} />
          </div>

          <div className="mb-6 grid grid-cols-3 gap-6">
            <Stat label="Single pin" value={stats.singleSeen ? `${Math.round((stats.singleMade / stats.singleSeen) * 100)}%` : "\u2014"} />
            <Stat label="Multi pin" value={stats.multiSeen ? `${Math.round((stats.multiMade / stats.multiSeen) * 100)}%` : "\u2014"} />
            <Stat label="Splits" value={stats.splitSeen ? `${Math.round((stats.splitMade / stats.splitSeen) * 100)}%` : "\u2014"} />
          </div>

          <p className="text-ink-soft mb-3 text-xs font-medium uppercase tracking-wide">
            What you leave most
          </p>
          <div className="space-y-2">
            {stats.leaves.slice(0, 6).map((l) => {
              const pct = Math.round((l.converted / l.seen) * 100);
              return (
                <div key={l.key} className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-3">
                  <span className="text-ink text-sm">
                    {l.name}
                    <span className="text-ink-soft ml-2 text-xs">{l.seen}×</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                      <span className="bg-accent block h-full" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="font-score text-ink-soft w-12 text-right text-xs">
                      {l.converted}/{l.seen}
                    </span>
                    <span className={`font-score w-10 text-right text-sm ${pct >= 50 ? "text-accent" : "text-ink-soft"}`}>
                      {pct}%
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!stats && (
        <div className="glass-panel p-8">
          <p className="text-ink-soft text-sm">
            Bowl a practice session with the pin-tap sheet and your leaves, strike
            rate and spare conversion show up here.
          </p>
          <Link href="/profile/score" className="pill-button bg-accent text-on-accent mt-4 inline-block px-5 py-2.5 text-sm">
            Log a session
          </Link>
        </div>
      )}

      <div className="glass-panel p-8">
        <p className="text-ink-soft mb-4 text-xs font-medium uppercase tracking-wide">
          Tournament history
        </p>
        {!rows.length ? (
          <p className="text-ink-soft text-sm">
            No tournaments yet. Once you enter one, every result lands here.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/t/${r.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-3 transition-colors hover:bg-white/8"
              >
                <span className="min-w-0">
                  <span className="text-ink block truncate text-sm">{r.name}</span>
                  <span className="text-ink-soft text-xs">
                    {r.centerName ? `${r.centerName} · ` : ""}
                    {r.date ? new Date(r.date).toLocaleDateString() : "no date"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4 text-right">
                  <span>
                    <span className={`font-score block text-lg ${r.position === 1 ? "text-accent" : "text-ink"}`}>
                      {ordinal(r.position)}
                    </span>
                    <span className="text-ink-soft text-[12px]">of {r.fieldSize}</span>
                  </span>
                  <span className="font-score text-accent w-16 text-sm">
                    {r.winnings ? formatMoney(r.winnings) : "—"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-ink-soft text-xs uppercase tracking-wide">{label}</p>
      <p className="font-score text-accent text-3xl leading-none">{value}</p>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
