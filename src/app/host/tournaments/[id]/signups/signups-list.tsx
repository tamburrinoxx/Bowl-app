"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Bowler = {
  id: string;
  slot: number;
  bowler_name: string;
  phone: string | null;
  reported_average: number;
  verified_average: number | null;
  handicap: number;
};

type Signup = {
  id: string;
  squad_id: string | null;
  entry_id: string | null;
  team_name: string;
  captain_email: string;
  waitlisted: boolean;
  scratch_division: boolean;
  created_at: string;
  team_signup_bowlers: Bowler[];
};

type Squad = {
  id: string;
  label: string;
  starts_at: string | null;
  max_entries: number | null;
};

export default function SignupsList({
  squads,
  signups,
}: {
  squads: Squad[];
  signups: Signup[];
}) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [rows, setRows] = useState<Signup[]>(signups);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function saveAverage(bowlerId: string) {
    const avg = Number(draft);
    setEditing(null);
    if (!draft.trim() || Number.isNaN(avg) || avg <= 0 || avg > 300) return;
    const { data, error } = await supabase.rpc("set_signup_average", {
      p_bowler: bowlerId,
      p_average: avg,
    });
    if (error) return;
    setRows((prev) =>
      prev.map((s) => ({
        ...s,
        team_signup_bowlers: s.team_signup_bowlers.map((b) =>
          b.id === bowlerId
            ? {
                ...b,
                reported_average: avg,
                verified_average: avg,
                handicap: Number(data?.handicap ?? b.handicap),
              }
            : b
        ),
      }))
    );
  }

  function Card({ s }: { s: Signup }) {
    const roster = [...s.team_signup_bowlers].sort((a, b) => a.slot - b.slot);
    const total = roster.reduce((t, b) => t + Number(b.handicap), 0);
    return (
      <div className="glass-panel">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {s.team_name}
              {s.scratch_division && (
                <span className="ml-2 rounded bg-[#B6FF2E] px-1.5 py-0.5 text-[10px] font-bold text-black">
                  SCRATCH
                </span>
              )}
            </p>
            <a href={`mailto:${s.captain_email}`} className="text-xs underline opacity-60">
              {s.captain_email}
            </a>
          </div>
          <div className="shrink-0 text-right text-xs opacity-70">
            <div>{total} hdcp</div>
            <div>{Math.round(total / 3)} baker</div>
          </div>
        </div>
        <div className="mt-3 grid gap-1.5">
          {roster.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {b.bowler_name}
                {b.phone && <span className="ml-2 text-xs opacity-50">{b.phone}</span>}
              </span>
              {editing === b.id ? (
                <input
                  autoFocus
                  defaultValue={String(b.reported_average)}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => saveAverage(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveAverage(b.id);
                  }}
                  inputMode="numeric"
                  className="w-20 rounded border border-white/20 bg-black/30 px-2 py-1 text-right text-sm"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(b.id);
                    setDraft(String(b.reported_average));
                  }}
                  className="rounded px-2 py-1 text-sm tabular-nums hover:bg-white/5"
                >
                  {b.reported_average} avg
                  {b.verified_average !== null && (
                    <span className="ml-1 text-xs opacity-50">OK</span>
                  )}
                </button>
              )}
              <span className="w-10 text-right text-sm tabular-nums opacity-70">
                {b.handicap}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const waitlist = rows.filter((s) => s.waitlisted);

  return (
    <div className="grid gap-6">
      {squads.map((sq) => {
        const teams = rows.filter((s) => s.squad_id === sq.id && !s.waitlisted);
        return (
          <section key={sq.id}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{sq.label}</h2>
              <span className="text-xs opacity-60">
                {teams.length} of {sq.max_entries ?? 24} teams
              </span>
            </div>
            <div className="grid gap-3">
              {teams.length === 0 ? (
                <p className="text-sm opacity-50">No teams yet.</p>
              ) : (
                teams.map((s) => <Card key={s.id} s={s} />)
              )}
            </div>
          </section>
        );
      })}

      {waitlist.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Waiting list</h2>
          <div className="grid gap-3">
            {waitlist.map((s) => (
              <Card key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
