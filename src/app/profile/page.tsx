"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile, PatternAverage, OilPattern, Session, SessionGame, BowlerNote } from "@/types";
import { aggregateStats } from "@/lib/bowling";

type SessionWithGames = Session & { session_games: SessionGame[] };

export default function ProfilePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [averages, setAverages] = useState<(PatternAverage & { oil_patterns: OilPattern })[]>(
    []
  );
  const [sessions, setSessions] = useState<SessionWithGames[]>([]);
  const [notes, setNotes] = useState<BowlerNote[]>([]);
  const [newNote, setNewNote] = useState("");

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [homeCenter, setHomeCenter] = useState("");
  const [handedness, setHandedness] = useState("");
  const [usbcId, setUsbcId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    setProfile(profileRow);

    if (profileRow) {
      const { data: avgRows } = await supabase
        .from("pattern_averages")
        .select("*, oil_patterns(*)")
        .eq("bowler_id", user.id);
      setAverages(avgRows ?? []);

      const { data: sessionRows } = await supabase
        .from("sessions")
        .select("*, session_games(*)")
        .eq("bowler_id", user.id)
        .order("played_at", { ascending: false })
        .limit(5);
      setSessions((sessionRows as SessionWithGames[]) ?? []);

      const { data: noteRows } = await supabase
        .from("bowler_notes")
        .select("*")
        .eq("bowler_id", user.id)
        .order("created_at", { ascending: false });
      setNotes(noteRows ?? []);
    }

    setLoading(false);
  }

  async function ensureBowlerProfile(userId: string, userEmail: string) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("profiles").insert({
        id: userId,
        full_name: fullName || userEmail,
        email: userEmail,
        home_center: homeCenter || null,
      handedness: handedness || null,
        usbc_id: usbcId || null,
        role: "bowler",
      });
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setBusy(false);
      return;
    }

    if (data.session && data.user) {
      await ensureBowlerProfile(data.user.id, email);
      setBusy(false);
      loadProfile();
      return;
    }

    setBusy(false);
    setMessage("Check your email to confirm your account, then come back and sign in.");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }

    if (data.user) {
      await ensureBowlerProfile(data.user.id, email);
    }

    setBusy(false);
    loadProfile();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setAverages([]);
    setSessions([]);
    setNotes([]);
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim() || !profile) return;

    const { data, error: noteErr } = await supabase
      .from("bowler_notes")
      .insert({ bowler_id: profile.id, content: newNote.trim() })
      .select()
      .single();

    if (!noteErr && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
  }

  async function toggleNote(note: BowlerNote) {
    const { error: noteErr } = await supabase
      .from("bowler_notes")
      .update({ done: !note.done })
      .eq("id", note.id);

    if (!noteErr) {
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, done: !n.done } : n))
      );
    }
  }

  async function deleteNote(id: string) {
    const { error: noteErr } = await supabase.from("bowler_notes").delete().eq("id", id);
    if (!noteErr) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-ink-soft">Loading…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm glass-panel p-8">
          <p className="font-score text-accent text-xs font-semibold tracking-wide mb-2 text-center uppercase">
            Bowler Profile
          </p>
          <h1 className="font-display text-3xl text-ink mb-8 text-center">
            {mode === "signup" ? "Create Your Profile" : "Welcome Back"}
          </h1>

          <form
            onSubmit={mode === "signup" ? handleSignUp : handleSignIn}
            className="space-y-4"
          >
            {mode === "signup" && (
              <>
                <div>
                  <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                    Name
                  </label>
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                    Home center
                  </label>
                  <input
                    value={homeCenter}
                    onChange={(e) => setHomeCenter(e.target.value)}
                    placeholder="Clubhouse No. 3"
                    className={inputClass}
                  />
                </div>
              <div>
                <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                  Hand
                </label>
                <select
                  value={handedness}
                  onChange={(e) => setHandedness(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select</option>
                  <option value="right">Right handed</option>
                  <option value="left">Left handed</option>
                  <option value="two-right">Two handed (right)</option>
                  <option value="two-left">Two handed (left)</option>
                </select>
              </div>
                <div>
                  <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                    USBC ID (optional)
                  </label>
                  <input
                    value={usbcId}
                    onChange={(e) => setUsbcId(e.target.value)}
                    placeholder="1234567"
                    className={inputClass}
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={inputClass}
              />
            </div>

            {error && (
              <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-2xl p-3">
                {error}
              </p>
            )}

            {message && (
              <p className="text-success text-sm bg-success/10 border border-success/20 rounded-2xl p-3">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="pill-button w-full bg-accent text-on-accent text-base py-3.5 hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Working…" : mode === "signup" ? "Create Profile" : "Sign In"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
              setMessage(null);
            }}
            className="text-sm text-accent font-medium block mx-auto mt-6"
          >
            {mode === "signup"
              ? "Already have a profile? Sign in"
              : "Need a profile? Sign up"}
          </button>
        </div>
      </main>
    );
  }

  const allGames = sessions.flatMap((s) =>
    (s.session_games ?? []).map((g) => g.frame_data)
  );
  const stats = aggregateStats(allGames);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl flex justify-end mb-4">
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
          className="text-ink-soft hover:text-ink text-xs uppercase tracking-wide border border-white/15 rounded-full px-4 py-2"
        >
          Sign out
        </button>
      </div>
      <div className="mx-auto max-w-2xl">
        <div className="glass-panel p-8 mb-6 flex items-baseline justify-between">
          <div>
            <p className="font-score text-accent text-xs font-semibold tracking-wide mb-1 uppercase">
              Bowler Profile
            </p>
            <h1 className="font-display text-4xl text-ink">{profile.full_name}</h1>
            {profile.home_center && (
              <p className="text-ink-soft text-sm mt-1">{profile.home_center}</p>
            )}
            <p className="text-ink-soft mt-3 text-xs uppercase tracking-wide">
              Bowl ID
            </p>
            <p className="font-score text-accent text-2xl tracking-widest">
              {profile.bowl_id}
            </p>
            <p className="text-ink-soft mt-1 text-xs">
              Give this to a host to enter a tournament with your verified average.
            </p>
          </div>
          <button onClick={handleSignOut} className="text-sm text-accent font-medium">
            Sign out
          </button>
        </div>

        <Link
          href="/profile/score"
          className="glass-panel p-6 mb-6 flex items-center justify-between hover:bg-white/8 transition-colors"
        >
          <div>
            <p className="font-display text-xl text-ink mb-1">Log a Session</p>
            <p className="text-ink-soft text-sm">Enter frame-by-frame scores for 3 games.</p>
          </div>
          <span className="text-accent text-2xl font-light">→</span>
        </Link>

        <section className="glass-panel p-8 mb-6">
          <h2 className="font-display text-xl text-ink mb-4">Recent Stats</h2>
          {stats.gamesCounted ? (
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Strike %" value={`${stats.strikePct}%`} />
              <StatBox label="Spare %" value={`${stats.sparePct}%`} />
              <StatBox label="Open %" value={`${stats.openPct}%`} />
              <StatBox label="Avg Score" value={String(stats.avgScore)} />
              <StatBox label="High Game" value={String(stats.highGame)} />
              <StatBox label="Games Logged" value={String(stats.gamesCounted)} />
            </div>
          ) : (
            <p className="text-ink-soft text-sm rounded-2xl bg-white/5 p-5">
              Log a session to start tracking your stats.
            </p>
          )}
        </section>

        <section className="glass-panel p-8 mb-6">
          <h2 className="font-display text-xl text-ink mb-4">
            Last {sessions.length || 5} Leagues / Tournaments
          </h2>
          {sessions.length ? (
            <div className="space-y-3">
              {sessions.map((s) => {
                const games = s.session_games ?? [];
                const total = games.reduce((sum, g) => sum + g.scratch_score, 0);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-2xl bg-white/5 px-5 py-4"
                  >
                    <div>
                      <p className="text-ink font-medium">{s.label}</p>
                      <p className="text-ink-soft text-xs mt-0.5">
                        {new Date(s.played_at).toLocaleDateString()} ·{" "}
                        {games.map((g) => g.scratch_score).join(" / ")}
                      </p>
                    </div>
                    <p className="font-score text-accent text-lg font-semibold">{total}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-ink-soft text-sm rounded-2xl bg-white/5 p-5">
              No sessions logged yet.
            </p>
          )}
        </section>

        <section className="glass-panel p-8 mb-6">
          <h2 className="font-display text-xl text-ink mb-4">Pattern Averages</h2>
          {averages.length ? (
            <div className="space-y-3">
              {averages.map((avg) => (
                <div
                  key={avg.id}
                  className="flex items-center justify-between rounded-2xl bg-white/5 px-5 py-4"
                >
                  <div>
                    <p className="text-ink font-medium">
                      {avg.oil_patterns?.name ?? "Unknown pattern"}
                    </p>
                    <p className="text-ink-soft text-xs mt-0.5">
                      {avg.games_counted} games
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-score text-accent text-lg font-semibold">
                      {avg.average}
                    </p>
                    {avg.verified && (
                      <p className="text-success text-xs font-medium">verified</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ink-soft text-sm rounded-2xl bg-white/5 p-5">
              No pattern averages yet. These build up as you bowl in tracked tournaments.
            </p>
          )}
        </section>

        <section className="glass-panel p-8">
          <h2 className="font-display text-xl text-ink mb-4">Notes to Work On</h2>
          <form onSubmit={addNote} className="flex gap-2 mb-4">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="e.g. Slow down my approach"
              className="glass-input flex-1 px-4 py-2.5 text-ink placeholder:text-ink-soft/60"
            />
            <button
              type="submit"
              className="pill-button bg-accent text-on-accent px-5 py-2.5 hover:brightness-110"
            >
              Add
            </button>
          </form>
          {notes.length ? (
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3"
                >
                  <button
                    onClick={() => toggleNote(note)}
                    className={`w-5 h-5 rounded-full border shrink-0 ${
                      note.done
                        ? "bg-accent border-accent"
                        : "border-ink-soft"
                    }`}
                  />
                  <p
                    className={`flex-1 text-sm ${
                      note.done ? "text-ink-soft line-through" : "text-ink"
                    }`}
                  >
                    {note.content}
                  </p>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-ink-soft text-xs hover:text-danger"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ink-soft text-sm rounded-2xl bg-white/5 p-5">
              Nothing here yet — jot down what to focus on next practice.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 text-center">
      <p className="font-score text-accent text-xl font-bold">{value}</p>
      <p className="text-ink-soft text-xs mt-1">{label}</p>
    </div>
  );
}

const inputClass =
  "glass-input w-full px-4 py-3 text-ink placeholder:text-ink-soft/60 text-base";
