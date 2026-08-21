/**
 * Match generation for bracket and stepladder stages.
 *
 * Pure functions: given seeded entries, produce the rows to insert into
 * tournament_matches. Nothing here touches the database.
 */

export interface SeededEntry {
  entry_id: string;
  entry_name: string;
  seed: number; // 1 = top seed
}

export interface MatchRow {
  key: string;
  round_number: number;
  match_number: number;
  entry_a: string | null;
  entry_b: string | null;
  seed_a: number | null;
  seed_b: number | null;
  winner_entry_id: string | null;
  next_key: string | null;
  next_slot: "a" | "b" | null;
  status: "pending" | "live" | "complete";
}

/** Standard bracket seeding order. n=8 gives [1,8,4,5,2,7,3,6]. */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const s of order) {
      next.push(s, n + 1 - s);
    }
    order = next;
  }
  return order;
}

function nextPowerOfTwo(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

export function generateBracket(entries: SeededEntry[]): MatchRow[] {
  if (entries.length < 2) return [];

  const size = nextPowerOfTwo(entries.length);
  const bySeed = new Map(entries.map((e) => [e.seed, e]));
  const order = seedOrder(size);

  const rounds = Math.log2(size);
  const matches: MatchRow[] = [];

  for (let i = 0; i < size / 2; i++) {
    const seedA = order[i * 2];
    const seedB = order[i * 2 + 1];
    const a = bySeed.get(seedA) ?? null;
    const b = bySeed.get(seedB) ?? null;

    const bye = (a && !b) || (b && !a);
    const winner = bye ? (a ?? b) : null;

    matches.push({
      key: `r1m${i}`,
      round_number: 1,
      match_number: i + 1,
      entry_a: a?.entry_id ?? null,
      entry_b: b?.entry_id ?? null,
      seed_a: a?.seed ?? null,
      seed_b: b?.seed ?? null,
      winner_entry_id: winner?.entry_id ?? null,
      next_key: rounds > 1 ? `r2m${Math.floor(i / 2)}` : null,
      next_slot: rounds > 1 ? (i % 2 === 0 ? "a" : "b") : null,
      status: bye ? "complete" : "pending",
    });
  }

  for (let r = 2; r <= rounds; r++) {
    const count = size / Math.pow(2, r);
    for (let i = 0; i < count; i++) {
      matches.push({
        key: `r${r}m${i}`,
        round_number: r,
        match_number: i + 1,
        entry_a: null,
        entry_b: null,
        seed_a: null,
        seed_b: null,
        winner_entry_id: null,
        next_key: r < rounds ? `r${r + 1}m${Math.floor(i / 2)}` : null,
        next_slot: r < rounds ? (i % 2 === 0 ? "a" : "b") : null,
        status: "pending",
      });
    }
  }

  // Propagate byes into round 2 so those slots aren't left blank.
  for (const m of matches) {
    if (m.status === "complete" && m.winner_entry_id && m.next_key) {
      const target = matches.find((x) => x.key === m.next_key);
      if (!target) continue;
      if (m.next_slot === "a") {
        target.entry_a = m.winner_entry_id;
        target.seed_a = m.seed_a ?? m.seed_b;
      } else {
        target.entry_b = m.winner_entry_id;
        target.seed_b = m.seed_a ?? m.seed_b;
      }
    }
  }

  return matches;
}

export function generateStepladder(entries: SeededEntry[]): MatchRow[] {
  if (entries.length < 2) return [];

  const sorted = [...entries].sort((a, b) => a.seed - b.seed);
  const n = sorted.length;
  const matches: MatchRow[] = [];

  const low = sorted[n - 1];
  const secondLow = sorted[n - 2];

  matches.push({
    key: "m1",
    round_number: 1,
    match_number: 1,
    entry_a: secondLow.entry_id,
    entry_b: low.entry_id,
    seed_a: secondLow.seed,
    seed_b: low.seed,
    winner_entry_id: null,
    next_key: n > 2 ? "m2" : null,
    next_slot: n > 2 ? "b" : null,
    status: "pending",
  });

  for (let step = 2; step <= n - 1; step++) {
    const waiting = sorted[n - 1 - step];
    matches.push({
      key: `m${step}`,
      round_number: step,
      match_number: 1,
      entry_a: waiting.entry_id,
      entry_b: null,
      seed_a: waiting.seed,
      seed_b: null,
      winner_entry_id: null,
      next_key: step < n - 1 ? `m${step + 1}` : null,
      next_slot: step < n - 1 ? "b" : null,
      status: "pending",
    });
  }

  return matches;
}
