"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { formatMoney } from "@/lib/payouts";
import { buildGroups } from "@/lib/bracketPots";
import type { Entry } from "@/types";
import VerifyBadge from "./verify-badge";
import LaneBar from "./lane-bar";

interface SidePot {
  id: string;
  name: string;
  pot_type: string;
  buy_in: number;
  bracket_size: number;
  allow_multiple: boolean;
}

type SortKey = "lane" | "name" | "avg" | "hdcp" | "owed" | "verif" | `pot:${string}`;

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
  locked,
}: {
  tournamentId: string;
  entries: Entry[];
  entryFee: number | null;
  locked: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [pots, setPots] = useState<SidePot[]>([]);
  const [sold, setSold] = useState<Record<string, PotEntry>>({});
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, { name: string; avg: string; hdcp: string; lane: string }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(locked);

  async function toggleLock() {
    const next = !isLocked;
    setBusy(true);
    const { error } = await supabase
      .from("tournaments").update({ check_in_locked: next }).eq("id", tournamentId);
    setBusy(false);
    if (error) { setIsError(true); setMessage(error.message); return; }
    setIsLocked(next);
    setMessage(next ? "Check-in locked." : "Check-in unlocked.");
    router.refresh();
  }
  const [sortKey, setSortKey] = useState<SortKey>("lane");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  function toggleSort(k: SortKey) {
    if (k === sortKey) { setSortDir((d) => (d === 1 ? -1 : 1)); return; }
    setSortKey(k);
    setSortDir(k === "avg" ? -1 : 1);
  }
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

  function draftFor(entry: Entry) {
    return (
      edits[entry.id] ?? {
        name: entry.entry_name,
        avg: entry.locked_average == null ? "" : String(entry.locked_average),
        hdcp: entry.locked_handicap == null ? "" : String(entry.locked_handicap),
        lane: entry.lane == null ? "" : String(entry.lane),
      }
    );
  }

  async function saveEntry(entry: Entry) {
    const d = edits[entry.id];
    if (!d) return;
    const changed =
      d.name !== entry.entry_name ||
      d.avg !== (entry.locked_average == null ? "" : String(entry.locked_average)) ||
      d.hdcp !== (entry.locked_handicap == null ? "" : String(entry.locked_handicap)) ||
      d.lane !== (entry.lane == null ? "" : String(entry.lane));
    if (!changed) return;

    setBusy(true);
    const { error } = await supabase
      .from("entries")
      .update({
        entry_name: d.name.trim() || entry.entry_name,
        locked_average: d.avg === "" ? null : Number(d.avg),
        locked_handicap: d.hdcp === "" ? null : Number(d.hdcp),
        lane: d.lane === "" ? null : Number(d.lane),
      })
      .eq("id", entry.id);
    setBusy(false);
    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }
    setMessage("Entry updated.");
    router.refresh();
  }

  async function removeEntry(entry: Entry) {
    if (!confirm(`Remove ${entry.entry_name}? Their scores and side pot buys go with them.`)) return;
    setBusy(true);
    const { error } = await supabase.from("entries").delete().eq("id", entry.id);
    setBusy(false);
    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }
    setMessage("Entry removed.");
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

  const sortedEntries = [...entries].sort((a, b) => {
    if (sortKey === "name") return sortDir * a.entry_name.localeCompare(b.entry_name);
    if (sortKey === "verif")
      return sortDir * a.verification_status.localeCompare(b.verification_status);
    if (sortKey === "owed") return sortDir * (owedFor(a.id) - owedFor(b.id));
    if (sortKey.startsWith("pot:")) {
      const pid = sortKey.slice(4);
      const qa = sold[key(pid, a.id)]?.quantity ?? 0;
      const qb = sold[key(pid, b.id)]?.quantity ?? 0;
      return sortDir * (qa - qb);
    }
    const av = sortKey === "lane" ? a.lane : sortKey === "avg" ? a.locked_average : a.locked_handicap;
    const bv = sortKey === "lane" ? b.lane : sortKey === "avg" ? b.locked_average : b.locked_handicap;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return sortDir * (av - bv);
  });

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={toggleLock}
          disabled={busy}
          className={`rounded px-3 py-2 text-sm font-bold ${
            isLocked
              ? "bg-[#B6FF2E] text-black"
              : "border border-white/20 text-white/70 hover:text-white"
          }`}
        >
          {isLocked ? "\ud83d\udd12 Locked \u2014 Unlock to edit" : "\ud83d\udd13 Lock check-in"}
        </button>
      </div>
      <div className="mb-3 flex items-center gap-3">
        <button onClick={toggleLock} disabled={busy}
          className={`rounded px-3 py-2 text-sm font-bold ${isLocked
            ? "bg-[#B6FF2E] text-black"
            : "border border-white/20 text-white/70"}`}>
          {isLocked ? "Locked \u2014 tap to unlock" : "Lock check-in"}
        </button>
      </div>
      {!isLocked && <LaneBar entries={entries} />}
      <div className="overflow-x-auto rounded-2xl bg-white/5">
        <table className="w-full text-left">
          <thead>
            <tr className="text-ink-soft text-xs uppercase tracking-wide">
              <SortTh label="Lane" k="lane" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} center />
              <SortTh label="Entry" k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortTh label="Avg" k="avg" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} center />
              <SortTh label="Hdcp" k="hdcp" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} center />
              {pots.map((p) => (
                <th key={p.id} className="px-3 py-3 text-center font-medium">
                  <button onClick={() => toggleSort(`pot:${p.id}`)}
                    className={sortKey === `pot:${p.id}` ? "text-accent" : ""}>
                    {p.name}</button>
                  <span className="text-ink-soft block text-[12px] normal-case">
                    {formatMoney(Number(p.buy_in))}
                    {p.allow_multiple ? " ea" : ""}
                  </span>
                </th>
              ))}
              <th className="text-accent px-4 py-3 text-right font-medium">
                <button onClick={() => toggleSort("owed")}>Owed</button></th>
              <th className="px-4 py-3 text-right font-medium">
                <button onClick={() => toggleSort("verif")}>Average</button></th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry) => (
              <tr key={entry.id} className="border-t border-white/5">
                <td className="px-3 py-2 text-center">
                  <input
                  disabled={isLocked}
                    type="number"
                    min={1}
                    value={draftFor(entry).lane}
                    onChange={(e) =>
                      setEdits((d) => ({ ...d, [entry.id]: { ...draftFor(entry), lane: e.target.value } }))
                    }
                    onBlur={() => saveEntry(entry)}
                    className="glass-input font-score w-14 px-2 py-1.5 text-center text-sm text-ink"
                  />
                </td>
                <td className="text-ink px-4 py-2 text-sm whitespace-nowrap">
                  <input
                  disabled={isLocked}
                    value={draftFor(entry).name}
                    onChange={(e) =>
                      setEdits((d) => ({ ...d, [entry.id]: { ...draftFor(entry), name: e.target.value } }))
                    }
                    onBlur={() => saveEntry(entry)}
                    className="glass-input w-36 px-3 py-1.5 text-sm text-ink"
                  />
                </td>
                <td className="font-score text-ink-soft px-3 py-2 text-center text-sm">
                  <input
                  disabled={isLocked}
                    type="number"
                    min={0}
                    max={300}
                    value={draftFor(entry).avg}
                    onChange={(e) =>
                      setEdits((d) => ({ ...d, [entry.id]: { ...draftFor(entry), avg: e.target.value } }))
                    }
                    onBlur={() => saveEntry(entry)}
                    className="glass-input font-score w-16 px-2 py-1.5 text-center text-sm text-ink"
                  />
                </td>
                <td className="font-score text-ink px-3 py-2 text-center text-sm">
                  <input
                  disabled={isLocked}
                    type="number"
                    min={0}
                    value={draftFor(entry).hdcp}
                    onChange={(e) =>
                      setEdits((d) => ({ ...d, [entry.id]: { ...draftFor(entry), hdcp: e.target.value } }))
                    }
                    onBlur={() => saveEntry(entry)}
                    className="glass-input font-score w-16 px-2 py-1.5 text-center text-sm text-ink"
                  />
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
                          disabled={busy || isLocked}
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
                          disabled={busy || isLocked}
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
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeEntry(entry)}
                    disabled={busy || isLocked}
                    aria-label={`Remove ${entry.entry_name}`}
                    className="text-ink-soft hover:text-red-400 px-2 text-sm disabled:opacity-40"
                  >
                    ×
                  </button>
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

function SortTh({ label, k, sortKey, sortDir, onClick, center }: {
  label: string;
  k: SortKey;
  sortKey: string;
  sortDir: 1 | -1;
  onClick: (k: SortKey) => void;
  center?: boolean;
}) {
  const active = sortKey === k;
  return (
    <th className={`${center ? "px-3 text-center" : "px-4"} py-3 font-medium`}>
      <button
        onClick={() => onClick(k)}
        className={`uppercase tracking-wide ${active ? "text-accent" : "hover:text-white"}`}
      >
        {label}
        {active ? (sortDir === 1 ? " \u2191" : " \u2193") : ""}
      </button>
    </th>
  );
}
