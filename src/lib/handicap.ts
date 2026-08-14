/**
 * Pattern-aware handicap calculation.
 *
 * Standard convention: handicap = (base - average) * percent, floored at 0.
 * The key difference from a typical single-number bowling app is that
 * `average` here is always the bowler's average ON THE SPECIFIC PATTERN
 * the tournament is bowled on -- not a lifetime blended average.
 */

export interface HandicapConfig {
  base: number;      // e.g. 220
  percent: number;   // e.g. 0.9 (90%)
}

export const DEFAULT_HANDICAP_CONFIG: HandicapConfig = {
  base: 220,
  percent: 0.9,
};

/**
 * Calculate handicap per game from a pattern-specific average.
 * Negative results are floored at 0 (scratch-plus bowlers get no handicap).
 */
export function calculateHandicap(
  patternAverage: number,
  config: HandicapConfig = DEFAULT_HANDICAP_CONFIG
): number {
  const raw = (config.base - patternAverage) * config.percent;
  return Math.max(0, Math.round(raw * 100) / 100);
}

/**
 * Rolling average update when a new verified game posts.
 * Returns the new games_counted / pins_total / average to persist.
 */
export function updateRollingAverage(
  currentGamesCounted: number,
  currentPinsTotal: number,
  newGameScore: number
) {
  const gamesCounted = currentGamesCounted + 1;
  const pinsTotal = currentPinsTotal + newGameScore;
  const average = Math.round((pinsTotal / gamesCounted) * 100) / 100;
  return { gamesCounted, pinsTotal, average };
}

/**
 * Snapshot the handicap for an entry at the moment they enter a tournament.
 * If the bowler has no average yet on this pattern, hosts typically assign
 * a provisional average (e.g. house average or a fixed entering average) --
 * that's a host-side decision, not something this function assumes.
 */
export function snapshotEntryHandicap(
  patternAverage: number | null,
  provisionalAverage: number | null,
  config: HandicapConfig = DEFAULT_HANDICAP_CONFIG
): { lockedAverage: number; lockedHandicap: number } {
  const avg = patternAverage ?? provisionalAverage ?? 0;
  return {
    lockedAverage: avg,
    lockedHandicap: calculateHandicap(avg, config),
  };
}
