"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BowlCard from "@/components/bowl-card";
import BackLink from "@/components/back-link";

type Card = {
  id: string;
  code: string;
  earned_at: string;
  detail: Record<string, unknown> | null;
};

export default function CardsPage() {
  const supabase = createClient();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setLoading(false); return; }
      const { data } = await supabase
        .from("achievements")
        .select("id, code, earned_at, detail")
        .eq("bowler_id", auth.user.id)
        .order("earned_at", { ascending: false });
      setCards((data as Card[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <main className="min-h-screen px-5 py-8 pb-24 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <BackLink />
        <h1 className="font-display text-ink mb-1 text-3xl sm:text-4xl">Collection</h1>
        <p className="text-ink-soft mb-6 text-sm">
          {cards.length} card{cards.length === 1 ? "" : "s"} — every one earned on the lanes.
        </p>

        {loading ? (
          <p className="text-ink-soft text-sm">Loading…</p>
        ) : cards.length === 0 ? (
          <div className="glass-panel p-6 text-center">
            <p className="text-ink-soft text-sm">No cards yet.</p>
            <p className="text-ink-soft/70 mt-1 text-xs">
              Cards come from real results — a 200 game, a clean game, a split conversion.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map((c) => (
              <BowlCard key={c.id} code={c.code} earnedAt={c.earned_at} detail={c.detail} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
