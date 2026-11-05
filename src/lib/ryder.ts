export type MatchPoints = { a: number; b: number; decided: boolean; note: string };

/**
 * Head-to-head formats (singles, 2-man Baker, Scotch doubles):
 * compare totals across game_count games. Within tieBuffer pins = half each.
 */
export function totalsPoints(
  scoresA: number[],
  scoresB: number[],
  gameCount: number,
  tieBuffer: number
): MatchPoints {
  const a = scoresA.filter(Boolean).length;
  const b = scoresB.filter(Boolean).length;
  if (a < gameCount || b < gameCount) {
    return { a: 0, b: 0, decided: false, note: "In progress" };
  }
  const ta = scoresA.reduce((x, y) => x + (y || 0), 0);
  const tb = scoresB.reduce((x, y) => x + (y || 0), 0);
  const diff = Math.abs(ta - tb);
  if (diff <= tieBuffer) {
    return { a: 0.5, b: 0.5, decided: true, note: `Tie — ${diff} pins apart` };
  }
  return ta > tb
    ? { a: 1, b: 0, decided: true, note: `+${diff}` }
    : { a: 0, b: 1, decided: true, note: `+${diff}` };
}

/**
 * Team Bakers, best of 7: 4 points to the first side with 4 game wins,
 * 1 more to the higher pinfall across the games actually bowled.
 */
export function bakerSeriesPoints(scoresA: number[], scoresB: number[]): MatchPoints {
  let winsA = 0, winsB = 0, played = 0;
  for (let i = 0; i < 7; i++) {
    const x = scoresA[i], y = scoresB[i];
    if (!x || !y) break;
    played++;
    if (x > y) winsA++;
    else if (y > x) winsB++;
    if (winsA === 4 || winsB === 4) break;
  }
  if (winsA < 4 && winsB < 4) {
    return { a: 0, b: 0, decided: false, note: `${winsA}-${winsB} through ${played}` };
  }
  const ta = scoresA.slice(0, played).reduce((x, y) => x + (y || 0), 0);
  const tb = scoresB.slice(0, played).reduce((x, y) => x + (y || 0), 0);
  const pinA = ta >= tb ? 1 : 0;
  const out = {
    a: (winsA === 4 ? 4 : 0) + pinA,
    b: (winsB === 4 ? 4 : 0) + (1 - pinA),
    decided: true,
    note: `${winsA}-${winsB} · pins ${ta}-${tb}`,
  };
  return out;
}

export function pointsFor(
  format: string,
  scoresA: number[],
  scoresB: number[],
  gameCount: number,
  tieBuffer: number
): MatchPoints {
  return /team baker|best of 7/i.test(format)
    ? bakerSeriesPoints(scoresA, scoresB)
    : totalsPoints(scoresA, scoresB, gameCount, tieBuffer);
}
