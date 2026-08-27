import { cashingSpots, distributePayouts } from "@/lib/payouts";
import { bracketPayout } from "@/lib/bracketPots";

/**
 * Winners and money for every kind of side pot.
 *
 * Kept apart from the UI so the same rules drive the host panel, the public
 * page and any payout sheet later — a pot should never be worth one number in
 * one place and a different number somewhere else.
 */

export interface Buyer {
  entryId: string;
  name: string;
  handicap: number;
  quantity: number;
}

export interface GameScore {
  entry_id: string;
  game_number: number;
  scratch_score: number;
}

export interface PotWin {
  entryId: string;
  name: string;
  amount: number;
  detail: string;
}

const total = (buyers: Buyer[]) => buyers.reduce((s, b) => s + b.quantity, 0);

function scoreOf(s: GameScore, buyers: Buyer[], useHandicap: boolean): number {
  const b = buyers.find((x) => x.entryId === s.entry_id);
  return s.scratch_score + (useHandicap ? (b?.handicap ?? 0) : 0);
}

/** Top score in every game, fund split evenly across the games. */
export function highGameWins(
  buyers: Buyer[],
  scores: GameScore[],
  buyIn: number,
  games: number,
  useHandicap: boolean,
): PotWin[] {
  const fund = total(buyers) * buyIn;
  const share = Math.floor(fund / Math.max(1, games));
  const remainder = fund - share * games;
  const wins: PotWin[] = [];

  for (let n = 1; n <= games; n++) {
    const pool = share + (n <= remainder ? 1 : 0);
    const inGame = scores
      .filter((s) => s.game_number === n && buyers.some((b) => b.entryId === s.entry_id))
      .map((s) => ({ id: s.entry_id, val: scoreOf(s, buyers, useHandicap) }));
    if (!inGame.length) continue;

    const top = Math.max(...inGame.map((x) => x.val));
    const leaders = inGame.filter((x) => x.val === top);
    const each = Math.floor(pool / leaders.length);

    for (const l of leaders) {
      wins.push({
        entryId: l.id,
        name: buyers.find((b) => b.entryId === l.id)?.name ?? "—",
        amount: each,
        detail: `Game ${n} high (${top})${leaders.length > 1 ? ", split" : ""}`,
      });
    }
  }
  return wins;
}

/** One leaderboard on total series, paying 1 in N of the buyers. */
export function highSeriesWins(
  buyers: Buyer[],
  scores: GameScore[],
  buyIn: number,
  ratio: number,
  useHandicap: boolean,
): PotWin[] {
  const fund = total(buyers) * buyIn;
  const spots = cashingSpots(total(buyers), ratio || 5);
  const amounts = distributePayouts(fund, spots);

  const ranked = buyers
    .map((b) => {
      const mine = scores.filter((s) => s.entry_id === b.entryId);
      const t = mine.reduce((sum, g) => sum + scoreOf(g, buyers, useHandicap), 0);
      return { b, total: t };
    })
    .filter((r) => r.total > 0)
    .sort((x, y) => y.total - x.total);

  return ranked.slice(0, spots).map((r, i) => ({
    entryId: r.b.entryId,
    name: r.b.name,
    amount: amounts[i]?.amount ?? 0,
    detail: `${i + 1}${i === 0 ? "st" : i === 1 ? "nd" : i === 2 ? "rd" : "th"} series (${r.total})`,
  }));
}

/**
 * Bottom finishers are cut after every game until one is left. The cut size is
 * derived so the field lands on a single survivor within the games available.
 */
export function eliminatorWins(
  buyers: Buyer[],
  scores: GameScore[],
  buyIn: number,
  games: number,
  useHandicap: boolean,
): PotWin[] {
  const fund = total(buyers) * buyIn;
  let alive = buyers.map((b) => b.entryId);
  if (alive.length < 2 || games < 1) return [];

  const cut = Math.max(1, Math.ceil((alive.length - 1) / games));

  for (let n = 1; n <= games && alive.length > 1; n++) {
    const played = scores
      .filter((s) => s.game_number === n && alive.includes(s.entry_id))
      .map((s) => ({ id: s.entry_id, val: scoreOf(s, buyers, useHandicap) }));

    if (played.length < alive.length) return [];

    played.sort((a, b) => b.val - a.val);
    const keep = Math.max(1, played.length - cut);
    alive = played.slice(0, keep).map((p) => p.id);
  }

  if (alive.length !== 1) return [];
  const winner = buyers.find((b) => b.entryId === alive[0]);
  if (!winner) return [];

  return [{ entryId: winner.entryId, name: winner.name, amount: fund, detail: "Last one standing" }];
}

export interface BracketMatch {
  bracket_group: number | null;
  round_number: number;
  entry_a: string | null;
  entry_b: string | null;
  winner_entry_id: string | null;
  status: string;
}

/** First and second in each completed bracket group. */
export function bracketWins(
  matches: BracketMatch[],
  names: Record<string, string>,
  buyIn: number,
  bracketSize: number,
): PotWin[] {
  const pay = bracketPayout(buyIn, bracketSize);
  const groups = [...new Set(matches.map((m) => m.bracket_group))];
  const wins: PotWin[] = [];

  for (const g of groups) {
    const inGroup = matches.filter((m) => m.bracket_group === g);
    if (!inGroup.length) continue;
    const lastRound = Math.max(...inGroup.map((m) => m.round_number));
    const final = inGroup.find((m) => m.round_number === lastRound);
    if (final?.status !== "complete" || !final.winner_entry_id) continue;

    const loser = final.entry_a === final.winner_entry_id ? final.entry_b : final.entry_a;

    wins.push({
      entryId: final.winner_entry_id,
      name: names[final.winner_entry_id] ?? "—",
      amount: pay.winner,
      detail: `Bracket ${g} winner`,
    });
    if (loser) {
      wins.push({
        entryId: loser,
        name: names[loser] ?? "—",
        amount: pay.runnerUp,
        detail: `Bracket ${g} runner-up`,
      });
    }
  }
  return wins;
}

/** Roll every pot's wins into one line per bowler. */
export function rollUp(wins: PotWin[]) {
  const byEntry = new Map<string, { name: string; amount: number; lines: string[] }>();
  for (const w of wins) {
    const cur = byEntry.get(w.entryId) ?? { name: w.name, amount: 0, lines: [] };
    cur.amount += w.amount;
    cur.lines.push(`${w.detail} $${w.amount}`);
    byEntry.set(w.entryId, cur);
  }
  return [...byEntry.entries()]
    .map(([entryId, v]) => ({ entryId, ...v }))
    .sort((a, b) => b.amount - a.amount);
}
