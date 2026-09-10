"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackLink from "@/components/back-link";

type League = { id: string; name: string; center: string | null; night: string | null; join_code: string };
type Member = { bowler_id: string; full_name: string | null };
type Week = { id: string; label: string; played_at: string; bowler_id: string };

export default function LeagueDetail() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const leagueId = String(params.id);

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);

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

      if (off) return;
      setLeague((l as League) ?? null);
      setMembers(
        ((m as unknown as { bowler_id: string; profiles: { full_name: string | null } | null }[]) ?? [])
          .map((r) => ({ bowler_id: r.bowler_id, full_name: r.profiles?.full_name ?? null }))
      );
      setWeeks((w as Week[]) ?? []);
      setLoading(false);
    })();
    return () => { off = true; };
  }, [leagueId, supabase]);

  if (loading) {
    return <main className="min-h-screen px-5 py-8"><p className="text-ink-soft">Loading…</p></main>;
  }
  if (!league) {
    return <main className="min-h-screen px-5 py-8"><p className="text-ink-soft">League not found.</p></main>;
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
          className="pill-button bg-accent text-on-accent mb-6 w-full py-3.5 text-base"
        >
          + Add this week
        </button>

        <section className="glass-panel mb-4 p-5 sm:p-6">
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
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass-panel p-5 sm:p-6">
          <h2 className="font-display text-ink mb-3 text-xl">Members</h2>
          <div className="space-y-1">
            {members.map((m) => (
              <p key={m.bowler_id} className="text-ink-soft text-sm">
                {m.full_name ?? "Bowler"}
              </p>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
