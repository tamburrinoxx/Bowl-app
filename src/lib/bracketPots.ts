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

export interface Refund {
  entryId: string;
  bought: number;
  seated: number;
  owed: number;
}

export interface GroupPlan {
  groups: string[][];
  /** Slots bought that couldn't be seated. Usually refunded. */
  leftover: number;
  groupSize: number;
  /** Per-bowler shortfall — who bought more brackets than they got into. */
  refunds: Refund[];
}

function deal(buys: BracketBuy[], groupCount: number, groupSize: number) {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  const maxQty = Math.max(0, ...buys.map((b) => b.quantity));

  // Deal in passes: everyone gets their first bracket before anyone gets a
  // second. Dealing heavy buyers first would let them crowd out a bowler who
  // bought two and ends up in none.
  for (let pass = 1; pass <= maxQty; pass++) {
    for (const buy of buys) {
      if (buy.quantity < pass) continue;
      const target = groups
        .map((g, i) => ({ i, size: g.length }))
        .filter(
          (c) => groups[c.i].length < groupSize && !groups[c.i].includes(buy.entryId),
        )
        .sort((x, y) => x.size - y.size)[0];
      if (target) groups[target.i].push(buy.entryId);
    }
  }

  return groups;
}

export function buildGroups(buys: BracketBuy[], groupSize = 8): GroupPlan {
  const totalSlots = buys.reduce((s, b) => s + b.quantity, 0);
  const distinct = buys.filter((b) => b.quantity > 0).length;

  const allRefunded = (): Refund[] =>
    buys
      .filter((b) => b.quantity > 0)
      .map((b) => ({ entryId: b.entryId, bought: b.quantity, seated: 0, owed: b.quantity }));

  if (distinct < groupSize) {
    return { groups: [], leftover: totalSlots, groupSize, refunds: allRefunded() };
  }

  // Try the most groups the slots allow, then step down until every group
  // fills. A heavy buyer can cap how many groups are actually reachable.
  for (let count = Math.floor(totalSlots / groupSize); count >= 1; count--) {
    const groups = deal(buys, count, groupSize);
    if (groups.every((g) => g.length === groupSize)) {
      const seatedBy = new Map<string, number>();
      for (const g of groups) {
        for (const id of g) seatedBy.set(id, (seatedBy.get(id) ?? 0) + 1);
      }
      const refunds: Refund[] = buys
        .filter((b) => b.quantity > (seatedBy.get(b.entryId) ?? 0))
        .map((b) => {
          const seated = seatedBy.get(b.entryId) ?? 0;
          return { entryId: b.entryId, bought: b.quantity, seated, owed: b.quantity - seated };
        });
      return { groups, leftover: totalSlots - count * groupSize, groupSize, refunds };
    }
  }

  return { groups: [], leftover: totalSlots, groupSize, refunds: allRefunded() };
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
