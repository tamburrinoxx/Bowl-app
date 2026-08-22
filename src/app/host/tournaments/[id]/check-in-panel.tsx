"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/payouts";
import type { Entry } from "@/types";

interface SidePot {
  id: string;
  name: string;
  buy_in: number;
  allow_multiple: boolean;
}

interface PotEntry {
  id: string;
  side_pot_id: string;
  entry_id: string;
  quantity: number;
  paid: boolean;
}

export default function CheckInPanel({
  tournamentId,
  entries,
  entryFee,
}: {
  tournamentId: string;
  entries: Entry[];
  entryFee: number | null;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [pots, setPots] = useState<SidePot[]>([]);
  const [sold, setSold] = useState<Record<string, PotEntry>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const key = (potId: string, entryId: string) => `${potId}:${entryId}`;

  const load = useCallback(async () => {
    const { data: potData } = await supabase
      .from("side_pots")
      .select("id, name, buy_in, allow_multiple")
      .eq("tournament_id", tournamentId)
      .order("sort_order")
      .order("created_at");

    const potList = (potData as SidePot[]) ?? [];
    setPots(potList);

    if (!potList.length || !entries.length) {
      setSold({});
      return;
    }

    const { data: soldData } = await supabase
      .from("side_pot_entries")
      .select("id, side_pot_id, entry_id, quantity, paid")
      .in("side_pot_id", potList.map((p) => p.id));

    const map: Record<string, PotEntry> = {};
    for (const s of (soldData as PotEntry[]) ?? []) {
      map[key(s.side_pot_id, s.entry_id)] = s;
    }
    setSold(map);
  }, [supabase, tournamentId, entries]);

  useEffect(() => {
    load();
  }, [load]);

  async function setQuantity(pot: SidePot, entryId: string, qty: number) {
    setBusy(true);
    setMessage(null);
    setIsError(false);

    const existing = sold[key(pot.id, entryId)];

    if (qty <= 0) {
      if (existing) {
        const { error } = await supabase
          .from("side_pot_entries")
          .delete()
          .eq("id", existing.id);
        if (error) {
          setBusy(false);
          setIsError(true);
          setMessage(error.message);
          return;
        }
      }
    } else if (existing) {
      const { error } = await supabase
        .from("side_pot_entries")
        .update({ quantity: qty })
        .eq("id", existing.id);
      if (error) {
        setBusy(false);
        setIsError(true);
        setMessage(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("side_pot_entries").insert({
        side_pot_id: pot.id,
        entry_id: entryId,
        quantity: qty,
      });
      if (error) {
        setBusy(false);
        setIsError(true);
        setMessage(error.message);
        return;
      }
    }

    setBusy(false);
    await load();
    router.refresh();
  }

  function owedFor(entryId: string) {
    const side = pots.reduce((sum, p) => {
      const s = sold[key(p.id, entryId)];
      return sum + (s ? s.quantity * Number(p.buy_in) : 0);
    }, 0);
    return (entryFee ?? 0) + side;
  }

  if (!entries.length) {
    return (
      <p className="text-ink-soft rounded-2xl bg-white/5 p-5 text-sm">
        Add entries before checking anyone in.
      </p>
    );
  }

  if (!pots.length) {
    return (
      <p className="text-ink-soft rounded-2xl bg-white/5 p-5 text-sm">
        Set up side pots above and they&apos;ll appear here for check-in.
      </p>
    );
  }

  const grandTotal = entries.reduce((s, e) => s + owedFor(e.id), 0);

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl bg-white/5">
        <table className="w-full text-left">
          <thead>
            <tr className="text-ink-soft text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Entry</th>
              {pots.map((p) => (
                <th key={p.id} className="px-3 py-3 text-center font-medium">
                  {p.name}
                  <span className="text-ink-soft block text-[10px] normal-case">
                    {formatMoney(Number(p.buy_in))}
                    {p.allow_multiple ? " ea" : ""}
                  </span>
                </th>
              ))}
              <th className="text-accent px-4 py-3 text-right font-medium">Owed</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-white/5">
                <td className="text-ink px-4 py-2 text-sm whitespace-nowrap">
                  {entry.entry_name}
                </td>
                {pots.map((pot) => {
                  const s = sold[key(pot.id, entry.id)];
                  const qty = s?.quantity ?? 0;
                  return (
                    <td key={pot.id} className="px-3 py-2 text-center">
                      {pot.allow_multiple ? (
                        <input
                          type="number"
                          min={0}
                          max={20}
                          inputMode="numeric"
                          value={qty || ""}
                          disabled={busy}
                          onChange={(e) =>
                            setQuantity(pot, entry.id, Number(e.target.value) || 0)
                          }
                          placeholder="0"
                          className={`glass-input font-score w-14 px-2 py-2 text-center text-ink ${
                            qty > 0 ? "ring-accent/50 ring-1" : ""
                          }`}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setQuantity(pot, entry.id, qty > 0 ? 0 : 1)}
                          className={`h-8 w-8 rounded-full text-sm font-semibold transition-colors ${
                            qty > 0
                              ? "bg-accent text-on-accent"
                              : "bg-white/8 text-ink-soft hover:bg-white/12"
                          }`}
                        >
                          {qty > 0 ? "✓" : ""}
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="font-score text-accent px-4 py-2 text-right">
                  {formatMoney(owedFor(entry.id))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-ink-soft mt-4 text-sm">
        {entryFee
          ? `Includes ${formatMoney(entryFee)} entry fee. `
          : "No entry fee set on this tournament. "}
        Total across all entries:{" "}
        <span className="font-score text-ink">{formatMoney(grandTotal)}</span>
      </p>

      {message && (
        <p className={`mt-3 text-sm ${isError ? "text-red-400" : "text-ink-soft"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
