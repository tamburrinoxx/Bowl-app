"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Ball = { id: string; name: string; retired: boolean };

export default function Arsenal() {
  const supabase = createClient();
  const [balls, setBalls] = useState<Ball[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data } = await supabase
      .from("balls").select("id, name, retired")
      .eq("bowler_id", auth.user.id)
      .order("created_at");
    setBalls((data as Ball[]) ?? []);
  }

  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("balls").insert({ bowler_id: auth.user.id, name: name.trim() });
    setName("");
    load();
  }

  async function toggle(b: Ball) {
    await supabase.from("balls").update({ retired: !b.retired }).eq("id", b.id);
    load();
  }

  return (
    <section className="glass-panel p-5 sm:p-8 mb-4 sm:mb-6">
      <h2 className="font-display text-xl text-ink mb-3">My Arsenal</h2>

      <form onSubmit={add} className="mb-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Storm Phaze II"
          className="glass-input flex-1 rounded-2xl bg-white/5 px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/50"
        />
        <button type="submit" className="pill-button bg-accent text-on-accent shrink-0 px-4 text-sm">
          Add
        </button>
      </form>

      {balls.length === 0 ? (
        <p className="text-ink-soft text-sm">No balls yet — add the ones you throw.</p>
      ) : (
        <div className="space-y-1.5">
          {balls.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-2.5">
              <span className={`text-sm ${b.retired ? "text-ink-soft/50 line-through" : "text-ink"}`}>
                {b.name}
              </span>
              <button onClick={() => toggle(b)} className="text-ink-soft/60 text-xs hover:text-ink">
                {b.retired ? "Unretire" : "Retire"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
