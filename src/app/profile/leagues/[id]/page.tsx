"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackLink from "@/components/back-link";
import HangsPanel from "@/components/hangs-panel";

type League = { id: string; name: string; center: string | null; night: string | null; join_code: string };
type Member = { bowler_id: string; full_name: string | null };
type Week = { id: string; label: string; played_at: string; bowler_id: string; scores?: number[] };

export default function LeagueDetail() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const leagueId = String(params.id);

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pinfall_draft");
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Date.now() - d.at > 3 * 60 * 60 * 1000) return;
      const thrown = (d.games ?? []).some((g: { rolls: number[] }[]) =>
        g.some((f) => f.rolls.length > 0)
      );
      if (thrown && d.leagueId === leagueId) setHasDraft(true);
    } catch {}
  }, [leagueId]);

  useEffect(() => {
    let off = false;
    (async () => {
      const { data: l } = await supabase
        .from("leagues").select("id, name, center, night, join_code")
        .eq("id", leagueId).single();

      const { data: m } = await supabase
        .from("league_members").select("bowler_id, profiles(full_name)")
        .eq("league_id", leagueId);

      const { data: w } = await supabase
        .from("sessions").select("id, label, played_at, bowler_id")
        .eq("league_id", leagueId)
        .order("played_at", { ascending: false });

      const weekIds = ((w as Week[]) ?? []).map((x) => x.id);
      const scoreMap: Record<string, number[]> = {};
      if (weekIds.length) {
        const { data: sg } = await supabase
          .from("session_games")
          .select("session_id, game_number, scratch_score")
          .in("session_id", weekIds)
          .order("game_number");
        for (const g of (sg as { session_id: string; scratch_score: number }[]) ?? []) {
          (scoreMap[g.session_id] ||= []).push(g.scratch_score);
        }
      }

      if (off) return;
      setLeague((l as League) ?? null);
      setMembers(
        ((m as unknown as { bowler_id: string; profiles: { full_name: string | null } | null }[]) ?? [])
          .map((r) => ({ bowler_id: r.bowler_id, full_name: r.profiles?.full_name ?? null }))
      );
      setWeeks(((w as Week[]) ?? []).map((x) => ({ ...x, scores: scoreMap[x.id] ?? [] })));
      setLoading(false);
    })();
    return () => { off = true; };
  }, [leagueId, supabase]);

  async function deleteLeague() {
    if (!league) return;
    if (!confirm(`Delete "${league.name}" and every week logged in it? This cannot be undone.`)) return;
    await supabase.from("hangs").delete().eq("league_id", league.id);
    await supabase.from("sessions").update({ league_id: null }).eq("league_id", league.id);
    const { error } = await supabase.from("leagues").delete().eq("id", league.id);
    if (error) { alert(error.message); return; }
    router.push("/profile/leagues");
  }

  async function removeWeek(id: string) {
    if (!confirm("Delete this series? This can't be undone.")) return;
    await supabase.from("session_games").delete().eq("session_id", id);
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (!error) setWeeks((prev) => prev.filter((w) => w.id !== id));
  }

  const mine = weeks.filter((w) => w.bowler_id === meId);
  const myGames = mine.flatMap((w) => w.scores ?? []);
  const myStats = myGames.length
    ? {
        games: myGames.length,
        avg: (myGames.reduce((a, b) => a + b, 0) / myGames.length).toFixed(2),
        high: Math.max(...myGames),
        series: Math.max(...mine.map((w) => (w.scores ?? []).reduce((a, b) => a + b, 0))),
      }
    : null;

  if (loading) {
    return <main className="min-h-screen px-5 py-8 pb-24 sm:px-6 sm:py-12"><p className="text-ink-soft">Loading…</p></main>;
  }
  if (!league) {
    return <main className="min-h-screen px-5 py-8 pb-24 sm:px-6 sm:py-12"><p className="text-ink-soft">League not found.</p></main>;
  }

  return (
    <main className="min-h-screen px-5 py-8 pb-24 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <BackLink />
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-ink text-3xl sm:text-4xl">{league.name}</h1>
            <p className="text-ink-soft text-sm">
              {[league.night, league.center].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-ink-soft text-[11px] uppercase tracking-wide">Code</p>
            <p className="font-score text-accent tracking-widest">{league.join_code}</p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/profile/score?league=${league.id}&label=${encodeURIComponent(league.name)}`)}
          className="pill-button bg-flame text-on-flame mb-6 w-full py-3.5 text-base"
        >
          {hasDraft ? "Continue this session" : "+ Add this week"}
        </button>

        <HangsPanel leagueId={leagueId} />

        {myStats && (
          <section className="glass-panel mb-4">
            <h2 className="font-display text-ink mb-3 text-xl">Your stats here</h2>
            <div className="grid grid-cols-4 gap-2">
              {[
                { k: "Average", v: myStats.avg },
                { k: "High game", v: String(myStats.high) },
                { k: "High series", v: String(myStats.series) },
                { k: "Games", v: String(myStats.games) },
              ].map((c) => (
                <div key={c.k} className="rounded-xl bg-white/5 px-2 py-2 text-center">
                  <p className="font-score text-accent text-lg leading-none">{c.v}</p>
                  <p className="text-ink-soft mt-1 text-[10px] uppercase">{c.k}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="glass-panel mb-4">
          <h2 className="font-display text-ink mb-3 text-xl">Weeks logged</h2>
          {weeks.length === 0 ? (
            <p className="text-ink-soft text-sm">Nothing yet — add this week to get started.</p>
          ) : (
            <div className="space-y-2">
              {weeks.map((w) => {
                const who = members.find((m) => m.bowler_id === w.bowler_id)?.full_name ?? "Bowler";
                return (
                  <div key={w.id} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-ink text-sm">{who}</p>
                      <p className="text-ink-soft text-xs">
                        {new Date(w.played_at).toLocaleDateString()}
                        {w.scores && w.scores.length > 0 && (
                          <span className="ml-2">{w.scores.join(" · ")}</span>
                        )}
                      </p>
                    </div>
                    <span className="flex items-center gap-3">
                      {w.scores && w.scores.length > 0 && (
                        <span className="font-score text-accent text-xl">
                          {w.scores.reduce((a, b) => a + b, 0)}
                        </span>
                      )}
                      <button
                        onClick={() => removeWeek(w.id)}
                        className="text-ink-soft/50 hover:text-danger text-xs"
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass-panel">
          <h2 className="font-display text-ink mb-3 text-xl">Members</h2>
          <div className="space-y-1">
            {members.map((m) => (
              <p key={m.bowler_id} className="text-ink-soft text-sm">
                {m.full_name ?? "Bowler"}
              </p>
            ))}
          </div>
        </section>

        <button
          onClick={deleteLeague}
          className="text-ink-soft/50 hover:text-danger mt-6 w-full py-3 text-xs"
        >
          Delete this league
        </button>
      </div>
    </main>
  );
}
