export interface FrameData {
  rolls: number[]; // 1-2 rolls for frames 1-9, 1-3 for frame 10
}

export function isStrike(frame: FrameData): boolean {
  return frame.rolls[0] === 10;
}

export function isSpare(frame: FrameData): boolean {
  return (
    frame.rolls.length >= 2 && frame.rolls[0] < 10 && frame.rolls[0] + frame.rolls[1] === 10
  );
}

export function isOpen(frame: FrameData): boolean {
  return (
    frame.rolls.length >= 2 && frame.rolls[0] < 10 && frame.rolls[0] + frame.rolls[1] < 10
  );
}

export function isFrameComplete(frame: FrameData, frameNumber: number): boolean {
  if (frameNumber < 10) {
    return frame.rolls[0] === 10 || frame.rolls.length >= 2;
  }
  // 10th frame: 2 rolls normally, 3 if a strike or spare was involved
  if (frame.rolls.length < 2) return false;
  const strikeOrSpare = frame.rolls[0] === 10 || frame.rolls[0] + frame.rolls[1] === 10;
  return strikeOrSpare ? frame.rolls.length >= 3 : frame.rolls.length >= 2;
}

/** Standard 10-pin scoring: strikes/spares get bonus pins from following rolls. */
export function scoreGame(frames: FrameData[]): number {
  const rolls = frames.flatMap((f) => f.rolls);
  let total = 0;
  let idx = 0;
  for (let frame = 0; frame < 10; frame++) {
    if (rolls[idx] === 10) {
      total += 10 + (rolls[idx + 1] ?? 0) + (rolls[idx + 2] ?? 0);
      idx += 1;
    } else if ((rolls[idx] ?? 0) + (rolls[idx + 1] ?? 0) === 10) {
      total += 10 + (rolls[idx + 2] ?? 0);
      idx += 2;
    } else {
      total += (rolls[idx] ?? 0) + (rolls[idx + 1] ?? 0);
      idx += 2;
    }
  }
  return total;
}

/** Cumulative score after each frame, matching a real scoresheet (blank/null until bonus rolls are known). */
export function cumulativeScores(frames: FrameData[]): (number | null)[] {
  const rolls = frames.flatMap((f) => f.rolls);
  const results: (number | null)[] = [];
  let total = 0;
  let idx = 0;
  for (let frame = 0; frame < 10; frame++) {
    const frameNumber = frame + 1;
    const f = frames[frame] ?? { rolls: [] };
    if (!isFrameComplete(f, frameNumber)) {
      results.push(null);
      continue;
    }
    if (rolls[idx] === 10) {
      const bonus1 = rolls[idx + 1];
      const bonus2 = rolls[idx + 2];
      const needsTwoBonus = frameNumber < 10;
      if (bonus1 === undefined || (needsTwoBonus && bonus1 !== 10 && bonus2 === undefined)) {
        results.push(null);
        continue;
      }
      total += 10 + (bonus1 ?? 0) + (bonus2 ?? 0);
      idx += 1;
    } else if ((rolls[idx] ?? 0) + (rolls[idx + 1] ?? 0) === 10) {
      const bonus1 = rolls[idx + 2];
      if (frameNumber < 10 && bonus1 === undefined) {
        results.push(null);
        continue;
      }
      total += 10 + (bonus1 ?? 0);
      idx += 2;
    } else {
      total += (rolls[idx] ?? 0) + (rolls[idx + 1] ?? 0);
      idx += 2;
    }
    results.push(total);
  }
  return results;
}

/** Short display marks for a frame: "X" strike, "/" spare, "-" miss, or the pin count. */
export function frameMarks(frame: FrameData, frameNumber: number): string[] {
  const r = frame.rolls;
  const isTenth = frameNumber === 10;

  if (!isTenth) {
    const marks: string[] = [];
    if (r[0] === 10) return ["X"];
    if (r[0] !== undefined) marks.push(r[0] === 0 ? "-" : String(r[0]));
    if (r[1] !== undefined) {
      marks.push(r[0] + r[1] === 10 ? "/" : r[1] === 0 ? "-" : String(r[1]));
    }
    return marks;
  }

  const marks: string[] = [];
  for (let i = 0; i < r.length; i++) {
    const val = r[i];
    if (val === 10) {
      marks.push("X");
      continue;
    }
    const prev = r[i - 1];
    if (i > 0 && prev !== undefined && prev !== 10 && prev + val === 10) {
      marks.push("/");
    } else {
      marks.push(val === 0 ? "-" : String(val));
    }
  }
  return marks;
}

export interface GameStats {
  strikes: number;
  spares: number;
  opens: number;
}

export function gameStats(frames: FrameData[]): GameStats {
  let strikes = 0;
  let spares = 0;
  let opens = 0;
  for (const f of frames.slice(0, 10)) {
    if (isStrike(f)) strikes++;
    else if (isSpare(f)) spares++;
    else if (isOpen(f)) opens++;
  }
  return { strikes, spares, opens };
}

export interface AggregateStats {
  strikePct: number;
  sparePct: number;
  openPct: number;
  avgScore: number;
  highGame: number;
  gamesCounted: number;
}

/** Aggregate stats across multiple games, each an array of 10 completed frames. */
export function aggregateStats(games: FrameData[][]): AggregateStats {
  let strikes = 0;
  let spares = 0;
  let opens = 0;
  let frameCount = 0;
  let scoreSum = 0;
  let highGame = 0;

  for (const g of games) {
    const s = gameStats(g);
    strikes += s.strikes;
    spares += s.spares;
    opens += s.opens;
    frameCount += 10;
    const score = scoreGame(g);
    scoreSum += score;
    if (score > highGame) highGame = score;
  }

  return {
    strikePct: frameCount ? Math.round((strikes / frameCount) * 1000) / 10 : 0,
    sparePct: frameCount ? Math.round((spares / frameCount) * 1000) / 10 : 0,
    openPct: frameCount ? Math.round((opens / frameCount) * 1000) / 10 : 0,
    avgScore: games.length ? Math.round(scoreSum / games.length) : 0,
    highGame,
    gamesCounted: games.length,
  };
}
