"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import BackLink from "@/components/back-link";

type League = {
  id: string;
  name: string;
  center: string | null;
  night: string | null;
  join_code: string;
};

export default function LeaguesPage() {
  const supabase = createClient();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<null | "create" | "join">(null);
  const [name, setName] = useState("");
  const [night, setNight] = useState("");
  const [center, setCenter] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const { data } = await supabase
      .from("leagues")
      .select("id, name, center, night, join_code")
      .order("created_at", { ascending: false });
    setLeagues((data as League[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createLeague(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setErr("Sign in first."); return; }
    const { data, error } = await supabase
      .from("leagues")
      .insert({ name, night: night || null, center: center || null, created_by: auth.user.id })
      .select("id").single();
    if (error) { setErr(error.message); return; }
    await supabase.from("league_members").insert({ league_id: data.id, bowler_id: auth.user.id });
    setName(""); setNight(""); setCenter(""); setSheet(null);
    load();
  }

  async function joinLeague(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const { error } = await supabase.rpc("join_league", { code: code.trim() });
    if (error) { setErr(error.message); return; }
    setCode(""); setSheet(null);
    load();
  }

  const inputClass =
    "glass-input w-full rounded-2xl bg-white/5 px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50";

  return (
    <main className="min-h-screen px-5 py-8 pb-24 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <BackLink />
        <div className="mb-5 flex items-center justify-between">
          <h1 className="font-display text-ink text-3xl sm:text-4xl">Leagues</h1>
          <button
            onClick={() => { setErr(""); setSheet("create"); }}
            aria-label="Add league"
            className="text-accent flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-2xl leading-none"
          >
            +
          </button>
        </div>

        {err && !sheet && (
          <p className="text-danger bg-danger/10 border-danger/20 mb-4 rounded-2xl border p-3 text-sm">{err}</p>
        )}

        {loading ? (
          <p className="text-ink-soft text-sm">Loading…</p>
        ) : leagues.length === 0 ? (
          <div className="glass-panel p-6 text-center">
            <p className="text-ink-soft text-sm">No leagues yet.</p>
            <p className="text-ink-soft/70 mt-1 text-xs">Tap + to create one or join with a code.</p>
          </div>
        ) : (
          <div className="glass-panel divide-y divide-white/10 overflow-hidden p-0">
            {leagues.map((l) => (
              <Link
                key={l.id}
                href={`/profile/leagues/${l.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-white/5"
              >
                <div>
                  <p className="text-ink text-base">{l.name}</p>
                  <p className="text-ink-soft text-xs">
                    {[l.night, l.center].filter(Boolean).join(" · ") || "\u2014"}
                  </p>
                </div>
                <span className="text-ink-soft/50 text-lg">›</span>
              </Link>
            ))}
          </div>
        )}

        {sheet && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/60 sm:items-center sm:justify-center"
            onClick={() => setSheet(null)}>
            <div className="glass-panel w-full rounded-b-none p-6 sm:max-w-md sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex gap-2">
                <button onClick={() => { setErr(""); setSheet("create"); }}
                  className={`flex-1 rounded-full py-2 text-sm ${sheet === "create" ? "bg-accent text-on-accent" : "text-ink-soft bg-white/5"}`}>
                  Create
                </button>
                <button onClick={() => { setErr(""); setSheet("join"); }}
                  className={`flex-1 rounded-full py-2 text-sm ${sheet === "join" ? "bg-accent text-on-accent" : "text-ink-soft bg-white/5"}`}>
                  Join
                </button>
              </div>

              {err && (
                <p className="text-danger bg-danger/10 border-danger/20 mb-3 rounded-2xl border p-3 text-sm">{err}</p>
              )}

              {sheet === "create" ? (
                <form onSubmit={createLeague} className="space-y-3">
                  <input required value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Thursday Night Mixed" className={inputClass} />
                  <input value={night} onChange={(e) => setNight(e.target.value)}
                    placeholder="Thursday" className={inputClass} />
                  <input value={center} onChange={(e) => setCenter(e.target.value)}
                    placeholder="Home center" className={inputClass} />
                  <button type="submit" className="pill-button bg-accent text-on-accent w-full py-3 text-sm">
                    Create league
                  </button>
                </form>
              ) : (
                <form onSubmit={joinLeague} className="space-y-3">
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="6-digit code" className={inputClass} />
                  <button type="submit" className="pill-button bg-accent text-on-accent w-full py-3 text-sm">
                    Join league
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
