"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Opening = {
  squad_id: string;
  label: string;
  starts_at: string | null;
  cap: number;
  taken: number;
};

type Row = { name: string; average: string; phone: string };

function hcp(avg: string, base: number, percent: number) {
  const a = Number(avg);
  if (!avg.trim() || Number.isNaN(a) || a <= 0 || a > 300) return null;
  return Math.max(0, Math.round((base - a) * percent));
}

function timeLabel(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SignupForm({
  tournamentId,
  base,
  percent,
  openings,
}: {
  tournamentId: string;
  base: number;
  percent: number;
  openings: Opening[];
}) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [squadId, setSquadId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { name: "", average: "", phone: "" },
    { name: "", average: "", phone: "" },
    { name: "", average: "", phone: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | {
    waitlisted: boolean;
    teamName: string;
    total: number;
  }>(null);

  const pct = percent > 1 ? percent / 100 : percent;
  const handicaps = rows.map((r) => hcp(r.average, base, pct));
  const complete = handicaps.every((h) => h !== null);
  const total = handicaps.reduce<number>((s, h) => s + (h ?? 0), 0);
  const baker = complete ? Math.round(total / 3) : null;

  const ready =
    Boolean(squadId) &&
    email.includes("@") &&
    complete &&
    rows.every((r) => r.name.trim().length > 1);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("submit_team_signup", {
      p_tournament: tournamentId,
      p_squad: squadId,
      p_team_name: teamName.trim() || null,
      p_captain_email: email.trim(),
      p_bowlers: rows.map((r) => ({
        name: r.name.trim(),
        average: Number(r.average),
        phone: r.phone.trim() || null,
      })),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data?.signup_id) {
      fetch("/api/signup-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupId: data.signup_id }),
      }).catch(() => {});
    }
    setDone({
      waitlisted: Boolean(data?.waitlisted),
      teamName: String(data?.team_name ?? ""),
      total: Number(data?.team_handicap ?? 0),
    });
  }

  if (done) {
    return (
      <div className="glass-panel text-center">
        <p className="text-lg font-semibold">
          {done.waitlisted ? "You're on the waiting list" : "You're in"}
        </p>
        <p className="mt-2 text-sm opacity-80">
          {done.teamName} — {done.total} pins of handicap across the three
          individual games.
        </p>
        <p className="mt-3 text-sm opacity-70">
          {done.waitlisted
            ? `That squad filled up. We'll email ${email} if a spot opens. To take the other squad instead, sign up again with at least one different bowler.`
            : `A confirmation is on its way to ${email}.`}
        </p>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-base";

  return (
    <div>
      <section className="glass-panel">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">
          Pick a squad
        </h2>
        <div className="mt-3 grid gap-2">
          {openings.map((o) => {
            const left = o.cap - o.taken;
            const full = left <= 0;
            const active = squadId === o.squad_id;
            return (
              <button
                key={o.squad_id}
                type="button"
                onClick={() => setSquadId(o.squad_id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-[var(--flame)] bg-[var(--flame-soft)]"
                    : "border-white/10"
                }`}
              >
                <span>
                  <span className="block font-semibold">{o.label}</span>
                  <span className="block text-xs opacity-60">
                    {timeLabel(o.starts_at)}
                  </span>
                </span>
                <span className="text-xs opacity-70">
                  {full ? "Full — waiting list" : `${left} of ${o.cap} left`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="glass-panel mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">
          Your trio
        </h2>
        <p className="mt-1 text-xs opacity-60">
          Use each bowler&apos;s 2026 book average. Handicap is{" "}
          {Math.round(pct * 100)}% of {base}.
        </p>
        <div className="mt-4 grid gap-5">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide opacity-50">
                  Bowler {i + 1}
                </span>
                {handicaps[i] !== null && (
                  <span className="text-xs opacity-70">{handicaps[i]} hdcp</span>
                )}
              </div>
              <input
                value={r.name}
                onChange={(e) => setRow(i, { name: e.target.value })}
                placeholder="Full name"
                autoComplete="off"
                className={field}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={r.average}
                  onChange={(e) => setRow(i, { average: e.target.value })}
                  placeholder="2026 average"
                  inputMode="numeric"
                  className={field}
                />
                <input
                  value={r.phone}
                  onChange={(e) => setRow(i, { phone: e.target.value })}
                  placeholder="Phone"
                  inputMode="tel"
                  className={field}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel mt-4 grid gap-3">
        <div className="grid gap-2">
          <label className="text-xs uppercase tracking-wide opacity-50">
            Team name (optional)
          </label>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Defaults to the three surnames"
            className={field}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs uppercase tracking-wide opacity-50">
            Captain&apos;s email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            inputMode="email"
            autoComplete="email"
            className={field}
          />
        </div>
      </section>

      {complete && (
        <div className="glass-panel mt-4 text-sm">
          <div className="flex justify-between">
            <span className="opacity-70">Team handicap, each individual game</span>
            <span className="font-semibold">{total}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="opacity-70">Baker handicap, each game</span>
            <span className="font-semibold">{baker}</span>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!ready || busy}
        className="mt-5 w-full rounded-xl bg-[var(--flame)] px-4 py-3.5 text-base font-semibold text-[var(--on-flame)] disabled:opacity-40"
      >
        {busy ? "Submitting..." : "Submit team"}
      </button>
      <p className="mt-3 text-center text-xs opacity-50">
        Averages are verified against bowl.com before squad day.
      </p>
    </div>
  );
}
