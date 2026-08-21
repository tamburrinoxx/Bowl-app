"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  cashingSpots,
  distributePayouts,
  formatMoney,
  suggestedFund,
} from "@/lib/payouts";

interface PayoutRecord {
  id: string;
  position: number;
  amount: number;
}

export default function PayoutsPanel({
  tournamentId,
  entryCount,
  entryFee,
  prizeFund,
  cashersRatio,
}: {
  tournamentId: string;
  entryCount: number;
  entryFee: number | null;
  prizeFund: number | null;
  cashersRatio: number;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [fund, setFund] = useState(
    String(prizeFund ?? suggestedFund(entryCount, entryFee) ?? 0),
  );
  const [ratio, setRatio] = useState(String(cashersRatio));
  const [rows, setRows] = useState<PayoutRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("tournament_payouts")
      .select("id, position, amount")
      .eq("tournament_id", tournamentId)
      .order("position");

    const list = (data as PayoutRecord[]) ?? [];
    setRows(list);
    const seeded: Record<number, string> = {};
    for (const r of list) seeded[r.position] = String(r.amount);
    setDrafts(seeded);
  }, [supabase, tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  const fundNum = Number(fund) || 0;
  const ratioNum = Math.max(1, Number(ratio) || 5);
  const spots = cashingSpots(entryCount, ratioNum);

  async function generate() {
    setBusy(true);
    setMessage(null);
    setIsError(false);

    const generated = distributePayouts(fundNum, spots);

    await supabase
      .from("tournament_payouts")
      .delete()
      .eq("tournament_id", tournamentId);

    const { error } = await supabase.from("tournament_payouts").insert(
      generated.map((g) => ({
        tournament_id: tournamentId,
        position: g.position,
        amount: g.amount,
      })),
    );

    if (!error) {
      await supabase
        .from("tournaments")
        .update({ prize_fund: fundNum, cashers_ratio: ratioNum })
        .eq("id", tournamentId);
    }

    setBusy(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    setMessage(`${generated.length} paying spots set.`);
    await load();
    router.refresh();
  }

  async function saveEdits() {
    setBusy(true);
    setMessage(null);
    setIsError(false);

    for (const r of rows) {
      const raw = drafts[r.position];
      if (raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (Number.isNaN(value) || value === Number(r.amount)) continue;
      const { error } = await supabase
        .from("tournament_payouts")
        .update({ amount: value })
        .eq("id", r.id);
      if (error) {
        setBusy(false);
        setIsError(true);
        setMessage(error.message);
        return;
      }
    }

    setBusy(false);
    setMessage("Payouts saved.");
    await load();
    router.refresh();
  }

  const draftTotal = Object.values(drafts).reduce(
    (s, v) => s + (v === "" || Number.isNaN(Number(v)) ? 0 : Number(v)),
    0,
  );
  const off = draftTotal - fundNum;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="text-ink-soft mb-1.5 block text-xs font-medium">
            Prize fund
          </span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={fund}
            onChange={(e) => setFund(e.target.value)}
            className="glass-input font-score w-32 px-4 py-2.5 text-ink"
          />
        </label>
        <label className="block">
          <span className="text-ink-soft mb-1.5 block text-xs font-medium">
            Pay 1 in
          </span>
          <input
            type="number"
            min={1}
            max={20}
            value={ratio}
            onChange={(e) => setRatio(e.target.value)}
            className="glass-input font-score w-20 px-4 py-2.5 text-ink"
          />
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={busy || fundNum <= 0 || entryCount < 1}
          className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Working…" : rows.length ? "Regenerate" : "Generate"}
        </button>
        <p className="text-ink-soft text-xs">
          {entryCount} {entryCount === 1 ? "entry" : "entries"} at 1:{ratioNum}{" "}
          pays {spots} {spots === 1 ? "spot" : "spots"}.
        </p>
      </div>

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl bg-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft text-left text-xs uppercase">
                  <th className="px-4 py-3">Place</th>
                  <th className="px-4 py-3 text-right">Payout</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="text-ink px-4 py-2">{ordinal(r.position)}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={drafts[r.position] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [r.position]: e.target.value,
                          }))
                        }
                        className="glass-input font-score w-28 px-3 py-2 text-right text-ink"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={saveEdits}
              disabled={busy}
              className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save payouts"}
            </button>
            <p className={`text-xs ${off === 0 ? "text-ink-soft" : "text-red-400"}`}>
              {formatMoney(draftTotal)} allocated
              {off === 0
                ? " — matches the fund."
                : off > 0
                  ? ` — ${formatMoney(off)} over the fund.`
                  : ` — ${formatMoney(-off)} left unallocated.`}
            </p>
          </div>
        </>
      )}

      {message && (
        <p className={`mt-3 text-sm ${isError ? "text-red-400" : "text-ink-soft"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
