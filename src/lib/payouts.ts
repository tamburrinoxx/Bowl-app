/**
 * Payout distribution.
 *
 * Convention: one cashing spot per N entries (1 in 5 is standard).
 * The curve decays so first place takes meaningfully more than the last
 * cashing spot. Amounts round to the nearest $5 and any remainder lands
 * on first, so payouts always sum to exactly the prize fund.
 */

export interface PayoutRow {
  position: number;
  amount: number;
}

/** How many spots pay, given entries and the ratio. Always at least one. */
export function cashingSpots(entries: number, ratio: number): number {
  if (entries < 1) return 0;
  return Math.max(1, Math.floor(entries / Math.max(1, ratio)));
}

/**
 * Spread `fund` across `spots` positions on a decaying curve.
 * First-to-last widens as the field grows: ~2.5x for a few spots, up to 6x deep.
 */
export function distributePayouts(fund: number, spots: number): PayoutRow[] {
  if (spots < 1 || fund <= 0) return [];
  if (spots === 1) return [{ position: 1, amount: round5(fund) }];

  const targetRatio = Math.min(6, Math.max(2.5, 2.5 + spots * 0.15));
  const p = Math.log(targetRatio) / Math.log(spots);

  const weights = Array.from({ length: spots }, (_, i) => Math.pow(i + 1, -p));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const rows: PayoutRow[] = weights.map((w, i) => ({
    position: i + 1,
    amount: round5((w / totalWeight) * fund),
  }));

  const drift = fund - rows.reduce((s, r) => s + r.amount, 0);
  rows[0].amount = Math.max(0, rows[0].amount + drift);

  return rows;
}

function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

/** Suggested fund when the host hasn't set one: entries x entry fee. */
export function suggestedFund(entries: number, entryFee: number | null): number {
  if (!entryFee || entries < 1) return 0;
  return entries * entryFee;
}

export function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
