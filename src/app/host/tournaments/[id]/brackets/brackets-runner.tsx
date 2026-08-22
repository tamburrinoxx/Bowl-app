"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildGroups } from "@/lib/bracketPots";
import { generateBracket, type SeededEntry } from "@/lib/brackets";
import { formatMoney } from "@/lib/payouts";

interface Pot {
  id: string;
  name: string;
  buy_in: number;
  bracket_size: number;
}

interface Match {
  id: string;
  side_pot_id: string | null;
  bracket_group: number | null;
  round_number: number;
  match_number: number;
  entry_a: string | null;
  entry_b: string | null;
  seed_a: number | null;
  seed_b: number | null;
  score_a: number | null;
  score_b: number | null;
  winner_entry_id: string | null;
  status: string;
}

export default function BracketsRunner({ tournamentId }: { tournamentId: string }) {
  const supabase = createClient();

  const [pots, setPots] = useState<Pot[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [buys, setBuys] = useState<Record<string, { entryId: string; quantity: number }[]>>({});
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});

  const load = useCallback(async () => {
    const { data: potData } = await supabase
      .from("side_pots")
      .select("id, name, buy_in, bracket_size")
      .eq("tournament_id", tournamentId)
      .eq("pot_type", "brackets")
      .order("sort_order");

    const potList = (potData as Pot[]) ?? [];
    setPots(potList);
    if (potList.length && !active) setActive(potList[0].id);
    if (!potList.length) return;

    const { data: buyData } = await supabase
      .from("side_pot_entries")
      .select("side_pot_id, entry_id, quantity")
      .in("side_pot_id", potList.map((p) => p.id));

    const grouped: Record<string, { entryId: string; quantity: number }[]> = {};
    for (const b of (buyData as { side_pot_id: string; entry_id: string; quantity: number }[]) ?? []) {
      (grouped[b.side_pot_id] ??= []).push({ entryId: b.entry_id, quantity: b.quantity });
    }
    setBuys(grouped);

    const { data: entryData } = await supabase
      .from("entries")
      .select("id, entry_name")
      .eq("tournament_id", tournamentId);

    const map: Record<string, string> = {};
    for (const e of (entryData as { id: string; entry_name: string }[]) ?? []) {
      map[e.id] = e.entry_name;
    }
    setNames(map);

    const { data: matchData } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .not("side_pot_id", "is", null)
      .order("bracket_group")
      .order("round_number")
      .order("match_number");

    setMatches((matchData as Match[]) ?? []);
  }, [supabase, tournamentId, active]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate(pot: Pot) {
    setBusy(true);
    setMessage(null);
    setIsError(false);

    const potBuys = buys[pot.id] ?? [];
    const plan = buildGroups(potBuys, pot.bracket_size || 8);

    if (!plan.groups.length) {
      setBusy(false);
      setIsError(true);
      setMessage(
        `Not enough to fill a bracket — ${plan.leftover} slots bought, need ${pot.bracket_size || 8} different bowlers.`,
      );
      return;
    }

    for (let g = 0; g < plan.groups.length; g++) {
      const seeded: SeededEntry[] = plan.groups[g].map((entryId, i) => ({
        entry_id: entryId,
        entry_name: names[entryId] ?? "—",
        seed: i + 1,
      }));

      const generated = generateBracket(seeded);

      const { data: inserted, error } = await supabase
        .from("tournament_matches")
        .insert(
          generated.map((m) => ({
            tournament_id: tournamentId,
            side_pot_id: pot.id,
            bracket_group: g + 1,
            round_number: m.round_number,
            match_number: m.match_number,
            entry_a: m.entry_a,
            entry_b: m.entry_b,
            seed_a: m.seed_a,
            seed_b: m.seed_b,
            winner_entry_id: m.winner_entry_id,
            status: m.status,
          })),
        )
        .select("id, round_number, match_number");

      if (error || !inserted) {
        setBusy(false);
        setIsError(true);
        setMessage(error?.message ?? "Could not create brackets.");
        return;
      }

      const idFor = new Map(
        (inserted as { id: string; round_number: number; match_number: number }[]).map(
          (r) => [`${r.round_number}-${r.match_number}`, r.id],
        ),
      );
      const keyToPos = new Map(
        generated.map((m) => [m.key, `${m.round_number}-${m.match_number}`]),
      );

      for (const m of generated) {
        if (!m.next_key) continue;
        const selfId = idFor.get(`${m.round_number}-${m.match_number}`);
        const nextId = idFor.get(keyToPos.get(m.next_key) ?? "");
        if (!selfId || !nextId) continue;
        await supabase
          .from("tournament_matches")
          .update({ next_match_id: nextId, next_slot: m.next_slot })
          .eq("id", selfId);
      }
    }

    setBusy(false);
    setMessage(
      `${plan.groups.length} brackets created.${plan.leftover ? ` ${plan.leftover} slots couldn't be seated — refund those.` : ""}`,
    );
    await load();
  }

  async function saveResult(m: Match) {
    const s = scores[m.id];
    if (!s || s.a === "" || s.b === "") return;
    const a = Number(s.a);
    const b = Number(s.b);
    if (a === b) {
      setIsError(true);
      setMessage("Ties can't advance — roll off or adjust.");
      return;
    }

    setBusy(true);
    setIsError(false);
    const { error } = await supabase
      .from("tournament_matches")
      .update({
        score_a: a,
        score_b: b,
        winner_entry_id: a > b ? m.entry_a : m.entry_b,
        status: "complete",
      })
      .eq("id", m.id);
    setBusy(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }
    await load();
  }

  if (!pots.length) {
    return (
      <p className="text-ink-soft glass-panel p-8 text-sm">
        No bracket pot on this tournament. Add one under Side Action.
      </p>
    );
  }

  const pot = pots.find((p) => p.id === active) ?? pots[0];
  const mine = matches.filter((m) => m.side_pot_id === pot.id);
  const groups = [...new Set(mine.map((m) => m.bracket_group))].sort(
    (a, b) => (a ?? 0) - (b ?? 0),
  );
  const potBuys = buys[pot.id] ?? [];
  const slots = potBuys.reduce((s, b) => s + b.quantity, 0);

  return (
    <div>
      {pots.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pots.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(p.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase ${
                p.id === pot.id ? "bg-accent text-on-accent" : "bg-white/5 text-ink-soft hover:bg-white/8"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="glass-panel mb-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-ink font-medium">{pot.name}</p>
          <p className="text-ink-soft text-xs">
            {slots} slots sold · {formatMoney(slots * Number(pot.buy_in))} ·{" "}
            {groups.length} bracket{groups.length === 1 ? "" : "s"} live
          </p>
        </div>
        {groups.length === 0 && (
          <button
            type="button"
            onClick={() => generate(pot)}
            disabled={busy}
            className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate brackets"}
          </button>
        )}
      </div>

      {message && (
        <p className={`mb-4 text-sm ${isError ? "text-red-400" : "text-accent"}`}>{message}</p>
      )}

      <div className="space-y-6">
        {groups.map((g) => {
          const inGroup = mine.filter((m) => m.bracket_group === g);
          const rounds = [...new Set(inGroup.map((m) => m.round_number))].sort((a, b) => a - b);
          const final = inGroup.find((m) => m.round_number === Math.max(...rounds));
          const champ = final?.winner_entry_id;

          return (
            <div key={g} className="glass-panel p-6">
              <div className="mb-4 flex items-baseline justify-between">
                <p className="font-display text-ink text-lg">Bracket {g}</p>
                {champ && (
                  <p className="font-score text-accent text-sm">
                    {names[champ]} wins {formatMoney(Number(pot.buy_in) * (pot.bracket_size || 8))}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {rounds.map((r) => (
                  <div key={r}>
                    <p className="text-ink-soft mb-2 text-xs uppercase tracking-wide">Round {r}</p>
                    <div className="space-y-2">
                      {inGroup
                        .filter((m) => m.round_number === r)
                        .map((m) => {
                          const done = m.status === "complete";
                          const ready = m.entry_a && m.entry_b;
                          const s = scores[m.id] ?? { a: "", b: "" };
                          return (
                            <div
                              key={m.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 p-3"
                            >
                              <span className="text-sm">
                                <span className={done && m.winner_entry_id === m.entry_a ? "text-accent font-medium" : "text-ink"}>
                                  {m.entry_a ? names[m.entry_a] : "TBD"}
                                </span>
                                <span className="text-ink-soft mx-2">vs</span>
                                <span className={done && m.winner_entry_id === m.entry_b ? "text-accent font-medium" : "text-ink"}>
                                  {m.entry_b ? names[m.entry_b] : "TBD"}
                                </span>
                              </span>
                              {done ? (
                                <span className="font-score text-accent text-sm">
                                  {m.score_a} – {m.score_b}
                                </span>
                              ) : ready ? (
                                <span className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={300}
                                    value={s.a}
                                    onChange={(e) => setScores((p) => ({ ...p, [m.id]: { ...s, a: e.target.value } }))}
                                    className="glass-input font-score w-16 px-2 py-1.5 text-center text-ink"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    max={300}
                                    value={s.b}
                                    onChange={(e) => setScores((p) => ({ ...p, [m.id]: { ...s, b: e.target.value } }))}
                                    className="glass-input font-score w-16 px-2 py-1.5 text-center text-ink"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => saveResult(m)}
                                    disabled={busy || s.a === "" || s.b === ""}
                                    className="pill-button bg-accent text-on-accent px-3 py-1.5 text-xs disabled:opacity-40"
                                  >
                                    Save
                                  </button>
                                </span>
                              ) : (
                                <span className="text-ink-soft text-xs">waiting</span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
