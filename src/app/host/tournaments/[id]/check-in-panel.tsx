"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { formatMoney } from "@/lib/payouts";
import { buildGroups } from "@/lib/bracketPots";
import type { Entry } from "@/types";
import VerifyBadge from "./verify-badge";

interface SidePot {
  id: string;
  name: string;
  pot_type: string;
  buy_in: number;
  bracket_size: number;
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
      .select("id, name, pot_type, buy_in, bracket_size, allow_multiple")
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

  const grandTotal = entries.reduce((s, e) => s + owedFor(e.id), 0);

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl bg-white/5">
        <table className="w-full text-left">
          <thead>
            <tr className="text-ink-soft text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Entry</th>
              <th className="px-3 py-3 text-center font-medium">Avg</th>
              <th className="px-3 py-3 text-center font-medium">Hdcp</th>
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
              <th className="px-4 py-3 text-right font-medium">Average</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-white/5">
                <td className="text-ink px-4 py-2 text-sm whitespace-nowrap">
                  {entry.entry_name}
                </td>
                <td className="font-score text-ink-soft px-3 py-2 text-center text-sm">
                  {entry.locked_average ?? "—"}
                </td>
                <td className="font-score text-ink px-3 py-2 text-center text-sm">
                  {entry.locked_handicap ?? "—"}
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
                <td className="px-4 py-2 text-right">
                  <VerifyBadge
                    entryId={entry.id}
                    status={entry.verification_status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pots
        .filter((p) => p.pot_type === "brackets")
        .map((p) => {
          const buys = entries
            .map((e) => ({
              entryId: e.id,
              quantity: sold[key(p.id, e.id)]?.quantity ?? 0,
            }))
            .filter((b) => b.quantity > 0);
          const plan = buildGroups(buys, p.bracket_size || 8);
          const slots = buys.reduce((s, b) => s + b.quantity, 0);
          return (
            <div
              key={p.id}
              className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/5 p-5"
            >
              <div>
                <p className="text-ink text-sm font-medium">{p.name}</p>
                <p className="text-ink-soft text-xs">
                  {slots} slots from {buys.length} bowlers ·{" "}
                  {plan.groups.length
                    ? `${plan.groups.length} full bracket${plan.groups.length === 1 ? "" : "s"}`
                    : `need ${p.bracket_size || 8} different bowlers`}
                  {plan.leftover ? ` · ${plan.leftover} unseated` : ""}
                </p>
              </div>
              <Link
                href={`/host/tournaments/${tournamentId}/brackets`}
                className={`pill-button px-6 py-2.5 text-sm ${
                  plan.groups.length
                    ? "bg-accent text-on-accent hover:brightness-110"
                    : "bg-white/8 text-ink-soft"
                }`}
              >
                Generate brackets →
              </Link>
            </div>
          );
        })}

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
