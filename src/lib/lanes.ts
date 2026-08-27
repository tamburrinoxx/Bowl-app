export type LanePair = { pair: number; lanes: [number, number] };
export type LaneAssignment = { id: string; lane: number };
export type AssignableEntry = {
  id: string;
  lane: number | null;
  lane_locked?: boolean | null;
};

export function pairsFor(laneStart: number, laneCount: number): LanePair[] {
  const start = Math.max(1, Math.floor(laneStart || 1));
  const count = Math.max(0, Math.floor(laneCount || 0));
  const pairs: LanePair[] = [];
  for (let i = 0; i + 1 < count; i += 2) {
    pairs.push({ pair: pairs.length + 1, lanes: [start + i, start + i + 1] });
  }
  if (count % 2 === 1) {
    const last = start + count - 1;
    pairs.push({ pair: pairs.length + 1, lanes: [last, last] });
  }
  return pairs;
}

export function capacityFor(laneStart: number, laneCount: number, perPair: number): number {
  const per = Math.max(1, Math.floor(perPair || 1));
  return pairsFor(laneStart, laneCount).length * per;
}

export function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function assignLanes(
  entries: AssignableEntry[],
  perPair: number,
  laneStart: number,
  laneCount: number,
  opts: { shuffle?: boolean } = {}
): LaneAssignment[] {
  const per = Math.max(1, Math.floor(perPair || 1));
  const pairs = pairsFor(laneStart, laneCount);
  if (pairs.length === 0) return [];
  const taken = new Map<number, number>();
  for (const e of entries) {
    if (e.lane_locked && e.lane != null) {
      taken.set(e.lane, (taken.get(e.lane) ?? 0) + 1);
    }
  }
  const movable = entries.filter((e) => !(e.lane_locked && e.lane != null));
  const queue = opts.shuffle ? shuffled(movable) : movable;
  const out: LaneAssignment[] = [];
  let q = 0;
  for (const p of pairs) {
    const used = (taken.get(p.lanes[0]) ?? 0) + (taken.get(p.lanes[1]) ?? 0);
    let room = per - used;
    let side = 0;
    while (room > 0 && q < queue.length) {
      out.push({ id: queue[q].id, lane: p.lanes[side % 2] });
      q++; side++; room--;
    }
  }
  return out;
}

export function nextOpenLane(
  assigned: { lane: number | null }[],
  perPair: number,
  laneStart: number,
  laneCount: number
): number | null {
  const per = Math.max(1, Math.floor(perPair || 1));
  const counts = new Map<number, number>();
  for (const a of assigned) {
    if (a.lane != null) counts.set(a.lane, (counts.get(a.lane) ?? 0) + 1);
  }
  for (const p of pairsFor(laneStart, laneCount)) {
    const a = counts.get(p.lanes[0]) ?? 0;
    const b = counts.get(p.lanes[1]) ?? 0;
    if (a + b < per) return a <= b ? p.lanes[0] : p.lanes[1];
  }
  return null;
}
