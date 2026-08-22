"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildGroups, bracketPayout } from "@/lib/bracketPots";
import { generateBracket, type SeededEntry } from "@/lib/brackets";
import { formatMoney } from "@/lib/payouts";

interface Pot {
  id: string;
  name: string;
  buy_in: number;
  bracket_size: number;
  scoring: string;
  game_numbers: number[];
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

export default function BracketsRunner({
  tournamentId,
  gamesPerSquad,
}: {
  tournamentId: string;
  gamesPerSquad: number;
}) {
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
  const [handicaps, setHandicaps] = useState<Record<string, number>>({});
  const [gameScores, setGameScores] = useState<
    { entry_id: string; game_number: number; scratch_score: number }[]
  >([]);
  const [picks, setPicks] = useState<number[]>([]);

  const load = useCallback(async () => {
    const { data: potData } = await supabase
      .from("side_pots")
      .select("id, name, buy_in, bracket_size, scoring, game_numbers")
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
      .select("id, entry_name, locked_handicap")
      .eq("tournament_id", tournamentId);

    const map: Record<string, string> = {};
    const hdcp: Record<string, number> = {};
    for (const e of (entryData as
      | { id: string; entry_name: string; locked_handicap: number | null }[]
      | null) ?? []) {
      map[e.id] = e.entry_name;
      hdcp[e.id] = e.locked_handicap ?? 0;
    }
    setNames(map);
    setHandicaps(hdcp);

    const { data: gs } = await supabase
      .from("games")
      .select("entry_id, game_number, scratch_score")
      .in("entry_id", Object.keys(map));
    setGameScores(
      (gs as { entry_id: string; game_number: number; scratch_score: number }[]) ?? [],
    );

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

  function scoreFor(entryId: string, gameNumber: number, useHandicap: boolean) {
    const g = gameScores.find(
      (x) => x.entry_id === entryId && x.game_number === gameNumber,
    );
    if (!g) return null;
    return g.scratch_score + (useHandicap ? (handicaps[entryId] ?? 0) : 0);
  }

  async function savePicks(pot: Pot, next: number[]) {
    setPicks(next);
    await supabase.from("side_pots").update({ game_numbers: next }).eq("id", pot.id);
  }

  /**
   * Resolve the bracket from scores already on the tournament grid. Runs round
   * by round because round 2's pairings don't exist until round 1 is decided
   * and the database trigger has advanced the winners.
   */
  async function pullScores(pot: Pot, roundCount: number) {
    const chosen = picks.length ? picks : pot.game_numbers;
    if (chosen.length < roundCount) {
      setIsError(true);
      setMessage(`Pick a game for all ${roundCount} rounds first.`);
      return;
    }

    setBusy(true);
    setMessage(null);
    setIsError(false);

    const useHandicap = pot.scoring === "handicap";
    let resolved = 0;
    let missing = 0;

    for (let r = 1; r <= roundCount; r++) {
      const { data: fresh } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("side_pot_id", pot.id)
        .eq("round_number", r);

      const gameNumber = chosen[r - 1];

      for (const m of (fresh as Match[]) ?? []) {
        if (m.status === "complete" || !m.entry_a || !m.entry_b) continue;
        const a = scoreFor(m.entry_a, gameNumber, useHandicap);
        const b = scoreFor(m.entry_b, gameNumber, useHandicap);
        if (a === null || b === null || a === b) {
          missing++;
          continue;
        }
        await supabase
          .from("tournament_matches")
          .update({
            score_a: a,
            score_b: b,
            winner_entry_id: a > b ? m.entry_a : m.entry_b,
            status: "complete",
          })
          .eq("id", m.id);
        resolved++;
      }
    }

    setBusy(false);
    setMessage(
      `${resolved} matches resolved.${missing ? ` ${missing} still need a score or a tiebreak.` : ""}`,
    );
    if (missing) setIsError(true);
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

      <BracketControls
        pot={pot}
        gamesPerSquad={gamesPerSquad}
        picks={picks.length ? picks : pot.game_numbers}
        onPick={(next) => savePicks(pot, next)}
        onPull={(rounds) => pullScores(pot, rounds)}
        plan={buildGroups(potBuys, pot.bracket_size || 8)}
        names={names}
        buyIn={Number(pot.buy_in)}
        hasBrackets={groups.length > 0}
        busy={busy}
      />

      {message && (
        <p className={`mb-4 text-sm ${isError ? "text-red-400" : "text-accent"}`}>{message}</p>
      )}

      <div className="space-y-6">
        {groups.map((g) => {
          const inGroup = mine.filter((m) => m.bracket_group === g);
          const rounds = [...new Set(inGroup.map((m) => m.round_number))].sort((a, b) => a - b);
          const lastRound = Math.max(...rounds);
          const champ = inGroup.find((m) => m.round_number === lastRound)?.winner_entry_id;
          const pay = bracketPayout(Number(pot.buy_in), pot.bracket_size || 8);

          return (
            <div key={g} className="glass-panel p-6">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-display text-ink text-lg">Bracket {g}</p>
                <p className="text-ink-soft font-score text-xs">
                  Winner {formatMoney(pay.winner)} · Runner-up {formatMoney(pay.runnerUp)}
                </p>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {rounds.map((r) => (
                  <div key={r} className="flex min-w-[200px] flex-1 flex-col">
                    <p className="text-ink-soft mb-3 text-center text-[10px] uppercase tracking-widest">
                      {r === lastRound ? "Final" : `Round ${r}`}
                    </p>
                    <div className="flex flex-1 flex-col justify-around gap-3">
                      {inGroup
                        .filter((m) => m.round_number === r)
                        .map((m) => {
                          const done = m.status === "complete";
                          const ready = m.entry_a && m.entry_b;
                          const sc = scores[m.id] ?? { a: "", b: "" };
                          return (
                            <div
                              key={m.id}
                              className="overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/5"
                            >
                              {(["a", "b"] as const).map((side) => {
                                const entryId = side === "a" ? m.entry_a : m.entry_b;
                                const score = side === "a" ? m.score_a : m.score_b;
                                const won = done && m.winner_entry_id === entryId;
                                return (
                                  <div
                                    key={side}
                                    className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${
                                      side === "a" ? "border-b border-white/10" : ""
                                    } ${won ? "bg-accent/15" : ""}`}
                                  >
                                    <span
                                      className={`truncate ${won ? "text-accent font-semibold" : entryId ? "text-ink" : "text-ink-soft"}`}
                                    >
                                      {entryId ? names[entryId] : "—"}
                                    </span>
                                    {done ? (
                                      <span className={`font-score shrink-0 ${won ? "text-accent" : "text-ink-soft"}`}>
                                        {score}
                                      </span>
                                    ) : ready ? (
                                      <input
                                        type="number"
                                        min={0}
                                        max={300}
                                        inputMode="numeric"
                                        value={sc[side]}
                                        onChange={(e) =>
                                          setScores((p) => ({
                                            ...p,
                                            [m.id]: { ...sc, [side]: e.target.value },
                                          }))
                                        }
                                        className="glass-input font-score w-12 shrink-0 px-1 py-1 text-center text-xs text-ink"
                                      />
                                    ) : (
                                      <span className="text-ink-soft shrink-0">–</span>
                                    )}
                                  </div>
                                );
                              })}
                              {!done && ready && (
                                <button
                                  type="button"
                                  onClick={() => saveResult(m)}
                                  disabled={busy || sc.a === "" || sc.b === ""}
                                  className="bg-accent text-on-accent w-full py-1.5 text-[10px] font-semibold uppercase tracking-wide disabled:opacity-30"
                                >
                                  Save
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}

                <div className="flex min-w-[150px] flex-col justify-center">
                  <p className="text-ink-soft mb-3 text-center text-[10px] uppercase tracking-widest">
                    Winner
                  </p>
                  <div
                    className={`rounded-xl px-3 py-3 text-center ${champ ? "bg-accent/15 ring-accent/40 ring-1" : "bg-white/5"}`}
                  >
                    <p className={`truncate text-sm ${champ ? "text-accent font-semibold" : "text-ink-soft"}`}>
                      {champ ? names[champ] : "TBD"}
                    </p>
                    {champ && (
                      <p className="font-score text-accent mt-1 text-xs">
                        {formatMoney(pay.winner)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketControls({
  pot,
  gamesPerSquad,
  picks,
  onPick,
  onPull,
  plan,
  names,
  buyIn,
  hasBrackets,
  busy,
}: {
  pot: Pot;
  gamesPerSquad: number;
  picks: number[];
  onPick: (next: number[]) => void;
  onPull: (rounds: number) => void;
  plan: ReturnType<typeof buildGroups>;
  names: Record<string, string>;
  buyIn: number;
  hasBrackets: boolean;
  busy: boolean;
}) {
  const rounds = Math.round(Math.log2(pot.bracket_size || 8));
  const chosen = Array.from({ length: rounds }, (_, i) => picks[i] ?? 0);
  const complete = chosen.every((n) => n > 0);

  return (
    <div className="glass-panel mb-6 p-6">
      <p className="text-ink-soft mb-3 text-xs font-medium uppercase tracking-wide">
        Which game feeds each round
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {chosen.map((val, i) => (
          <label key={i} className="block">
            <span className="text-ink-soft mb-1.5 block text-xs">
              {i + 1 === rounds ? "Final" : `Round ${i + 1}`}
            </span>
            <select
              value={val}
              onChange={(e) => {
                const next = [...chosen];
                next[i] = Number(e.target.value);
                onPick(next);
              }}
              className="glass-input px-4 py-2.5 text-ink"
            >
              <option value={0}>—</option>
              {Array.from({ length: gamesPerSquad }, (_, g) => g + 1).map((g) => (
                <option key={g} value={g}>
                  Game {g}
                </option>
              ))}
            </select>
          </label>
        ))}
        <span className="text-ink-soft pb-3 text-xs uppercase">{pot.scoring}</span>
        {hasBrackets && (
          <button
            type="button"
            disabled={busy || !complete}
            onClick={() => onPull(rounds)}
            className="pill-button bg-accent text-on-accent px-6 py-2.5 text-sm hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "Pulling…" : "Pull scores"}
          </button>
        )}
      </div>

      {plan.refunds.length > 0 && (
        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-ink-soft mb-2 text-xs font-medium uppercase tracking-wide">
            Refunds owed
          </p>
          <div className="space-y-1">
            {plan.refunds.map((r) => (
              <div key={r.entryId} className="flex items-center justify-between text-sm">
                <span className="text-ink">
                  {names[r.entryId] ?? "—"}
                  <span className="text-ink-soft ml-2 text-xs">
                    bought {r.bought}, in {r.seated}
                  </span>
                </span>
                <span className="font-score text-red-400">${r.owed * buyIn}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
