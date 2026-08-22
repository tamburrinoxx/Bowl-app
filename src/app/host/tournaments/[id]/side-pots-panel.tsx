"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/payouts";

interface SidePot {
  id: string;
  name: string;
  pot_type: string;
  buy_in: number;
  scoring: string;
  bracket_size: number;
  payout_ratio: number;
  allow_multiple: boolean;
  sort_order: number;
}

const POT_TYPES = [
  { value: "brackets", label: "Brackets", multiple: true, defaultName: "Brackets" },
  { value: "high_game", label: "High Game", multiple: false, defaultName: "High Game" },
  { value: "high_series", label: "High Series", multiple: false, defaultName: "High Series" },
  { value: "eliminator", label: "Eliminator", multiple: false, defaultName: "Eliminator" },
  { value: "custom", label: "Custom", multiple: false, defaultName: "Side Pot" },
];

export default function SidePotsPanel({ tournamentId }: { tournamentId: string }) {
  const supabase = createClient();
  const router = useRouter();

  const [pots, setPots] = useState<SidePot[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [potType, setPotType] = useState("brackets");
  const [name, setName] = useState("Brackets");
  const [buyIn, setBuyIn] = useState("5");
  const [scoring, setScoring] = useState("handicap");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("side_pots")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("sort_order")
      .order("created_at");

    const list = (data as SidePot[]) ?? [];
    setPots(list);

    if (list.length) {
      const { data: sold } = await supabase
        .from("side_pot_entries")
        .select("side_pot_id, quantity")
        .in("side_pot_id", list.map((p) => p.id));

      const tally: Record<string, number> = {};
      for (const s of (sold as { side_pot_id: string; quantity: number }[]) ?? []) {
        tally[s.side_pot_id] = (tally[s.side_pot_id] ?? 0) + s.quantity;
      }
      setCounts(tally);
    } else {
      setCounts({});
    }
  }, [supabase, tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  function pickType(value: string) {
    setPotType(value);
    const def = POT_TYPES.find((t) => t.value === value);
    if (def) setName(def.defaultName);
  }

  async function addPot() {
    setBusy(true);
    setMessage(null);
    setIsError(false);

    const def = POT_TYPES.find((t) => t.value === potType);

    const { error } = await supabase.from("side_pots").insert({
      tournament_id: tournamentId,
      name: name.trim() || def?.defaultName || "Side Pot",
      pot_type: potType,
      buy_in: Number(buyIn) || 5,
      scoring,
      allow_multiple: def?.multiple ?? false,
      sort_order: pots.length,
    });

    setBusy(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    setMessage("Side pot added.");
    await load();
    router.refresh();
  }

  async function removePot(id: string) {
    setBusy(true);
    const { error } = await supabase.from("side_pots").delete().eq("id", id);
    setBusy(false);
    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }
    await load();
    router.refresh();
  }

  return (
    <div>
      {pots.length > 0 && (
        <div className="mb-5 space-y-2">
          {pots.map((p) => {
            const sold = counts[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 p-4"
              >
                <div>
                  <p className="text-ink text-sm font-medium">{p.name}</p>
                  <p className="text-ink-soft text-xs">
                    {formatMoney(Number(p.buy_in))} · {p.scoring}
                    {p.allow_multiple ? " · multiple allowed" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-score text-accent text-lg">
                      {formatMoney(sold * Number(p.buy_in))}
                    </p>
                    <p className="text-ink-soft text-xs">{sold} sold</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePot(p.id)}
                    disabled={busy}
                    className="text-ink-soft text-xs hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-white/5 p-5">
        <label className="block">
          <span className="text-ink-soft mb-1.5 block text-xs font-medium">Type</span>
          <select
            value={potType}
            onChange={(e) => pickType(e.target.value)}
            className="glass-input px-4 py-2.5 text-ink"
          >
            {POT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-ink-soft mb-1.5 block text-xs font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input px-4 py-2.5 text-ink"
          />
        </label>

        <label className="block">
          <span className="text-ink-soft mb-1.5 block text-xs font-medium">Buy-in</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={buyIn}
            onChange={(e) => setBuyIn(e.target.value)}
            className="glass-input font-score w-24 px-4 py-2.5 text-ink"
          />
        </label>

        <label className="block">
          <span className="text-ink-soft mb-1.5 block text-xs font-medium">Scoring</span>
          <select
            value={scoring}
            onChange={(e) => setScoring(e.target.value)}
            className="glass-input px-4 py-2.5 text-ink"
          >
            <option value="handicap">Handicap</option>
            <option value="scratch">Scratch</option>
          </select>
        </label>

        <button
          type="button"
          onClick={addPot}
          disabled={busy}
          className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add pot"}
        </button>
      </div>

      {message && (
        <p className={`mt-3 text-sm ${isError ? "text-red-400" : "text-ink-soft"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
