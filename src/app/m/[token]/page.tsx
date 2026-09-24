"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Match = {
  id: string;
  session_label: string;
  format: string;
  side_a_label: string;
  side_b_label: string;
  score_a: number;
  score_b: number;
};

export default function MatchScorer() {
  const supabase = createClient();
  const token = String(useParams().token);
  const [m, setM] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ryder_matches")
        .select("id, session_label, format, side_a_label, side_b_label, score_a, score_b")
        .eq("share_token", token)
        .single();
      setM((data as Match) ?? null);
      setLoading(false);
    })();
  }, [token, supabase]);

  async function bump(side: "a" | "b", delta: number) {
    if (!m) return;
    const next = {
      score_a: side === "a" ? Math.max(0, (m.score_a ?? 0) + delta) : m.score_a,
      score_b: side === "b" ? Math.max(0, (m.score_b ?? 0) + delta) : m.score_b,
    };
    setM({ ...m, ...next });
    const { error } = await supabase
      .from("ryder_matches")
      .update(next)
      .eq("share_token", token);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    }
  }

  if (loading) {
    return <main className="min-h-screen px-5 py-10"><p className="text-ink-soft">Loading…</p></main>;
  }
  if (!m) {
    return (
      <main className="min-h-screen px-5 py-10">
        <p className="text-ink-soft">That match link isn&apos;t valid.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-md">
        <p className="text-ink-soft mb-1 text-xs uppercase tracking-[0.2em]">
          {m.session_label} · {m.format}
        </p>
        <h1 className="font-display text-ink mb-6 text-3xl">Match score</h1>

        {[
          { key: "a" as const, label: m.side_a_label, score: m.score_a ?? 0 },
          { key: "b" as const, label: m.side_b_label, score: m.score_b ?? 0 },
        ].map((s) => (
          <div key={s.key} className="glass-panel mb-4 p-5">
            <p className="text-ink mb-3 text-lg font-semibold">{s.label}</p>
            <div className="flex items-center justify-between">
              <button onClick={() => bump(s.key, -1)}
                className="h-14 w-14 rounded-full bg-white/10 text-2xl text-ink">−</button>
              <span className="font-score text-accent text-5xl">{s.score}</span>
              <button onClick={() => bump(s.key, 1)}
                className="bg-accent text-on-accent h-14 w-14 rounded-full text-2xl">+</button>
            </div>
          </div>
        ))}

        <p className="text-ink-soft h-5 text-center text-xs">
          {saved ? "Saved" : ""}
        </p>

        <div className="glass-panel mt-8 p-5 text-center">
          <p className="text-ink text-sm font-semibold">Track your own bowling</p>
          <p className="text-ink-soft mb-3 mt-1 text-xs">
            Scores, averages and every leave you throw at — one profile that follows you.
          </p>
          <Link href="/login" className="pill-button bg-accent text-on-accent px-5 py-2.5 text-sm">
            Create a free profile
          </Link>
        </div>
      </div>
    </main>
  );
}
