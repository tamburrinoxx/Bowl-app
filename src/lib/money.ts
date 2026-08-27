/**
 * Where an entry fee actually goes.
 *
 * Lineage comes off the top — that's the centre's, charged per game bowled,
 * and it isn't the director's to spend. Whatever remains splits between the
 * prize fund and the director's cut.
 */

export interface FeeSplit {
  entryFee: number;
  lineage: number;
  afterLineage: number;
  director: number;
  prizePerEntry: number;
}

export function splitEntryFee(
  entryFee: number,
  games: number,
  lineagePerGame: number,
  directorPercent: number,
): FeeSplit {
  const fee = Math.max(0, entryFee);
  const lineage = Math.max(0, games) * Math.max(0, lineagePerGame);
  const afterLineage = Math.max(0, fee - lineage);
  const director = Math.round((afterLineage * Math.max(0, directorPercent)) / 100);
  return {
    entryFee: fee,
    lineage,
    afterLineage,
    director,
    prizePerEntry: Math.max(0, afterLineage - director),
  };
}
