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
  singleSeen: number;
  singleMade: number;
  multiSeen: number;
  multiMade: number;
  splitSeen: number;
  splitMade: number;
  makeableSeen: number;
  makeableMade: number;
  firstBallStrikePct: number;
  leaves: LeaveStat[];
}

const ROW: Record<number, number> = { 1:0, 2:1,3:1, 4:2,5:2,6:2, 7:3,8:3,9:3,10:3 };
const COL: Record<number, number> = { 1:3, 2:2,3:4, 4:1,5:3,6:5, 7:0,8:2,9:4,10:6 };

export function isSplitLeave(standing: number[]): boolean {
  if (standing.includes(1) || standing.length < 2) return false;
  const cols = standing.map((p) => COL[p]).sort((a, b) => a - b);
  for (let i = 1; i < cols.length; i++) {
    if (cols[i] - cols[i - 1] >= 2) return true;
  }
  const rows = new Set(standing.map((p) => ROW[p]));
  return rows.size > 1 && cols[cols.length - 1] - cols[0] >= 3;
}

export function analysePinLogs(games: number[][][][]): BowlingStats {
  let frames = 0;
  let strikes = 0;
  let spares = 0;
  let opens = 0;
  let singleSeen = 0, singleMade = 0;
  let multiSeen = 0, multiMade = 0;
  let splitSeen = 0, splitMade = 0;
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

      const isSplit = isSplitLeave(standing);
      if (isSplit) {
        splitSeen++;
        if (cleared) splitMade++;
      } else if (standing.length === 1) {
        singleSeen++;
        if (cleared) singleMade++;
      } else {
        multiSeen++;
        if (cleared) multiMade++;
      }

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
    singleSeen, singleMade, multiSeen, multiMade, splitSeen, splitMade,
    makeableSeen: singleSeen + multiSeen,
    makeableMade: singleMade + multiMade,
    firstBallStrikePct: frames ? Math.round((strikes / frames) * 1000) / 10 : 0,
    leaves,
  };
}
