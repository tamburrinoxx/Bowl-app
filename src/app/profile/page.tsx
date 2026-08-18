"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, PatternAverage, OilPattern } from "@/types";

export default function ProfilePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [averages, setAverages] = useState<(PatternAverage & { oil_patterns: OilPattern })[]>(
    []
  );

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [homeCenter, setHomeCenter] = useState("");
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
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-walnut text-chalk flex items-center justify-center">
        <p className="font-score text-chalk/50">Loading…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-walnut text-chalk px-6 py-12 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <p className="font-score text-scoreboard-amber text-sm mb-2 text-center">
            BOWLER PROFILE
          </p>
          <h1 className="font-display text-3xl mb-8 text-center">
            {mode === "signup" ? "Create Your Profile" : "Sign In"}
          </h1>

          <form
            onSubmit={mode === "signup" ? handleSignUp : handleSignIn}
            className="space-y-4"
          >
            {mode === "signup" && (
              <>
                <div>
                  <label className="font-score text-xs uppercase text-chalk/60 block mb-1">
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
                  <label className="font-score text-xs uppercase text-chalk/60 block mb-1">
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
                  <label className="font-score text-xs uppercase text-chalk/60 block mb-1">
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
              <label className="font-score text-xs uppercase text-chalk/60 block mb-1">
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
              <label className="font-score text-xs uppercase text-chalk/60 block mb-1">
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
              <p className="text-pindeck-red font-score text-sm border border-pindeck-red/40 rounded p-3">
                {error}
              </p>
            )}

            {message && (
              <p className="text-verified-green font-score text-sm border border-verified-green/40 rounded p-3">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="font-display w-full bg-scoreboard-amber text-walnut text-lg py-3 rounded-md hover:brightness-110 transition disabled:opacity-50"
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
            className="font-score text-xs text-chalk/50 hover:text-chalk block mx-auto mt-6"
          >
            {mode === "signup"
              ? "Already have a profile? Sign in"
              : "Need a profile? Sign up"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-walnut text-chalk px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-baseline justify-between border-b border-walnut-mid pb-6 mb-8">
          <div>
            <p className="font-score text-scoreboard-amber text-sm mb-1">BOWLER PROFILE</p>
            <h1 className="font-display text-4xl">{profile.full_name}</h1>
            {profile.home_center && (
              <p className="font-score text-chalk/50 text-sm mt-1">{profile.home_center}</p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="font-score text-xs text-chalk/50 hover:text-chalk"
          >
            Sign out
          </button>
        </div>

        <section>
          <h2 className="font-display text-xl text-scoreboard-amber mb-3">
            Pattern Averages
          </h2>
          {averages.length ? (
            <div className="space-y-2">
              {averages.map((avg) => (
                <div
                  key={avg.id}
                  className="flex items-center justify-between border border-walnut-mid rounded-md px-4 py-3"
                >
                  <div>
                    <p className="font-body">{avg.oil_patterns?.name ?? "Unknown pattern"}</p>
                    <p className="font-score text-xs text-chalk/50">
                      {avg.games_counted} games
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-score text-scoreboard-amber text-lg">{avg.average}</p>
                    {avg.verified && (
                      <p className="font-score text-xs text-verified-green">verified</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-chalk/50 font-score text-sm border border-walnut-mid rounded-md p-4">
              No pattern averages yet. These build up as you bowl in tracked tournaments.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

const inputClass =
  "w-full bg-walnut border border-walnut-mid rounded-md px-3 py-2 text-chalk placeholder:text-chalk/30 focus:outline-none focus:ring-2 focus:ring-scoreboard-amber";
