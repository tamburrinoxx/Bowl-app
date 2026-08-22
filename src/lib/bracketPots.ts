/**
 * Bracket pot grouping.
 *
 * A bowler who buys 5 brackets goes into 5 separate groups of 8, each its own
 * single-elimination tree paying its own winner. Two rules matter: nobody can
 * appear in the same group twice (they'd bowl themselves), and a group only
 * runs if it fills completely.
 */

export interface BracketBuy {
  entryId: string;
  quantity: number;
}

export interface GroupPlan {
  groups: string[][];
  /** Slots bought that couldn't be seated. Usually refunded. */
  leftover: number;
  groupSize: number;
}

function deal(buys: BracketBuy[], groupCount: number, groupSize: number) {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);

  // Heaviest buyers first — they're hardest to place without repeating, so
  // give them the most open groups to choose from.
  const ordered = [...buys].sort((a, b) => b.quantity - a.quantity);

  for (const buy of ordered) {
    let placed = 0;
    const candidates = groups
      .map((g, i) => ({ i, size: g.length }))
      .sort((a, b) => a.size - b.size);

    for (const c of candidates) {
      if (placed >= buy.quantity) break;
      if (groups[c.i].length >= groupSize) continue;
      if (groups[c.i].includes(buy.entryId)) continue;
      groups[c.i].push(buy.entryId);
      placed++;
    }
  }

  return groups;
}

export function buildGroups(buys: BracketBuy[], groupSize = 8): GroupPlan {
  const totalSlots = buys.reduce((s, b) => s + b.quantity, 0);
  const distinct = buys.filter((b) => b.quantity > 0).length;

  if (distinct < groupSize) {
    return { groups: [], leftover: totalSlots, groupSize };
  }

  // Try the most groups the slots allow, then step down until every group
  // fills. A heavy buyer can cap how many groups are actually reachable.
  for (let count = Math.floor(totalSlots / groupSize); count >= 1; count--) {
    const groups = deal(buys, count, groupSize);
    if (groups.every((g) => g.length === groupSize)) {
      return { groups, leftover: totalSlots - count * groupSize, groupSize };
    }
  }

  return { groups: [], leftover: totalSlots, groupSize };
}

/**
 * A bracket's own purse: every seat's buy-in, paid out to the last two.
 * $5 x 8 = $40 -> $25 / $15.  $10 x 8 = $80 -> $50 / $30.
 */
export const BRACKET_WINNER_SHARE = 0.625;

export function bracketPayout(buyIn: number, groupSize = 8) {
  const fund = buyIn * groupSize;
  const winner = Math.round((fund * BRACKET_WINNER_SHARE) / 5) * 5;
  return { fund, winner, runnerUp: fund - winner };
}
