"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Hang = { id: string; name: string; tally: number };

export default function HangsPanel({ leagueId, compact = false }: { leagueId: string; compact?: boolean }) {
  const supabase = createClient();
  const [on, setOn] = useState(false);
  const [rows, setRows] = useState<Hang[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const { data: lg } = await supabase
      .from("leagues").select("hangs_enabled").eq("id", leagueId).single();
    setOn(!!(lg as { hangs_enabled: boolean })?.hangs_enabled);
    const { data } = await supabase
      .from("hangs").select("id,name,tally").eq("league_id", leagueId).order("created_at");
    setRows((data as Hang[]) ?? []);
  }

  useEffect(() => { load(); }, [leagueId]);

  async function toggle() {
    const next = !on;
    setOn(next);
    await supabase.from("leagues").update({ hangs_enabled: next }).eq("id", leagueId);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await supabase.from("hangs").insert({ league_id: leagueId, name: name.trim() });
    setName(""); load();
  }

  async function bump(h: Hang, d: number) {
    const t = Math.max(0, h.tally + d);
    setRows((p) => p.map((r) => (r.id === h.id ? { ...r, tally: t } : r)));
    await supabase.from("hangs").update({ tally: t }).eq("id", h.id);
  }

  async function remove(id: string) {
    await supabase.from("hangs").delete().eq("id", id);
    load();
  }

  if (compact && !on) return null;

  return (
    <section className="glass-panel mb-4 !p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-ink text-lg leading-none">Hangs</h2>
          <p className="text-ink-soft text-[11px] leading-tight">Everyone else struck, you didn&apos;t.</p>
        </div>
        {!compact && <button
          onClick={toggle}
          className={`h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-flame" : "bg-white/15"}`}
          aria-label="Toggle hangs"
        >
          <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
        </button>}
      </div>

      {on && (
        <>
          {!compact && <form onSubmit={add} className="mb-2 mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bowler name"
              className="glass-input flex-1 rounded-2xl bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50"
            />
            <button type="submit" className="pill-button bg-flame text-on-flame shrink-0 px-4 text-sm">
              Add
            </button>
          </form>}

          {rows.length === 0 ? (
            <p className="text-ink-soft text-sm">No bowlers yet.</p>
          ) : (
            <div className="space-y-1">
              {rows.map((h) => (
                <div key={h.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5">
                  <span className="text-ink flex-1 text-sm">{h.name}</span>
                  <button onClick={() => bump(h, -1)}
                    className="text-ink-soft h-7 w-7 rounded-full bg-white/10 text-base leading-none">−</button>
                  <span className="font-score text-accent w-7 text-center text-lg">{h.tally}</span>
                  <button onClick={() => bump(h, 1)}
                    className="bg-flame text-on-flame h-7 w-7 rounded-full text-base leading-none">+</button>
                  <button onClick={() => remove(h.id)}
                    className="text-ink-soft/40 hover:text-danger ml-1 text-xs">×</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
