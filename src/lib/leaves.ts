export const ALL_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const NAMED: Record<string, string> = {
  "10": "10 pin",
  "7": "7 pin",
  "4": "4 pin",
  "6": "6 pin",
  "7,10": "7-10 split",
  "4,6": "4-6 split",
  "4,7,10": "4-7-10",
  "5,7": "5-7 split",
  "5,10": "5-10 split",
  "3,10": "3-10 baby split",
  "2,7": "2-7 baby split",
  "2,4,5,8": "bucket",
  "3,5,6,9": "bucket",
  "1,2,4,7": "washout",
  "1,3,6,10": "washout",
  "4,7": "4-7",
  "6,10": "6-10",
  "8,10": "8-10 split",
};

export function leaveName(pins: number[]): string {
  const key = [...pins].sort((a, b) => a - b).join(",");
  if (NAMED[key]) return NAMED[key];
  if (pins.length === 1) return `${pins[0]} pin`;
  return key.replace(/,/g, "-");
}

export interface LeaveStat {
  key: string;
  name: string;
  pins: number[];
  seen: number;
  converted: number;
}

export interface BowlingStats {
  frames: number;
  strikes: number;
  spares: number;
  opens: number;
  strikePct: number;
  sparePct: number;
  leaves: LeaveStat[];
}

export function analysePinLogs(games: number[][][][]): BowlingStats {
  let frames = 0;
  let strikes = 0;
  let spares = 0;
  let opens = 0;
  const leaveMap = new Map<string, LeaveStat>();

  for (const game of games) {
    if (!Array.isArray(game)) continue;

    for (const frame of game) {
      if (!Array.isArray(frame) || frame.length === 0) continue;

      const first = frame[0] ?? [];
      frames++;

      if (first.length === 10) {
        strikes++;
        continue;
      }

      const standing = ALL_PINS.filter((p) => !first.includes(p));
      if (!standing.length) continue;

      const key = [...standing].sort((a, b) => a - b).join(",");
      const second = frame[1] ?? [];
      const cleared = standing.every((p) => second.includes(p));

      if (cleared) spares++;
      else opens++;

      const existing = leaveMap.get(key);
      if (existing) {
        existing.seen++;
        if (cleared) existing.converted++;
      } else {
        leaveMap.set(key, {
          key,
          name: leaveName(standing),
          pins: standing,
          seen: 1,
          converted: cleared ? 1 : 0,
        });
      }
    }
  }

  const leaves = [...leaveMap.values()].sort((a, b) => b.seen - a.seen);

  return {
    frames,
    strikes,
    spares,
    opens,
    strikePct: frames ? Math.round((strikes / frames) * 100) : 0,
    sparePct: spares + opens ? Math.round((spares / (spares + opens)) * 100) : 0,
    leaves,
  };
}
