import type { AdvanceRule, ScoringMode, StageType } from "@/types";

export type SkillSpread = "similar" | "wide";
export type FinishStyle = "simple" | "dramatic" | "survivor" | "head_to_head";

/** Rough minutes one game takes per bowler sharing a lane. */
const MIN_PER_GAME_PER_BOWLER = 11;
/** Comfortable bowlers per lane before a squad feels crowded. */
const COMFORTABLE_PER_LANE = 5;
/** Setup, check-in, and practice overhead. */
const OVERHEAD_MIN = 20;

export interface FormatInputs {
  entrySize: number;
  entries: number;
  lanes: number;
  hours: number;
  skillSpread: SkillSpread;
  finishStyle: FinishStyle;
}

export interface PlannedStage {
  name: string;
  stage_type: StageType;
  scoring_mode: ScoringMode;
  games: number | null;
  cut_per_game: number | null;
  advance_count: number | null;
  advance_rule: AdvanceRule;
  bonus_pins_per_win: number;
  carry_pins: boolean;
  estimated_minutes: number;
  blurb: string;
}

export interface FormatPlan {
  format: "handicap" | "scratch";
  stages: PlannedStage[];
  squads: number;
  bowlersPerLane: number;
  qualifyingGames: number;
  totalMinutes: number;
  availableMinutes: number;
  fits: boolean;
  notes: string[];
}

function largestPowerOfTwo(n: number): number {
  let p = 2;
  while (p * 2 <= n) p *= 2;
  return Math.max(2, p);
}

export function planTournament(
  inputs: FormatInputs,
  overrideGames?: number,
): FormatPlan {
  const entries = Math.max(1, Math.floor(inputs.entries));
  const lanes = Math.max(1, Math.floor(inputs.lanes));
  const entrySize = Math.max(1, Math.floor(inputs.entrySize));
  const bowlers = entries * entrySize;

  const capacityPerSquad = lanes * COMFORTABLE_PER_LANE;
  const squads = Math.max(1, Math.ceil(bowlers / capacityPerSquad));
  const bowlersPerLane = Math.ceil(bowlers / squads / lanes);
  const entriesPerLane = Math.max(1, Math.ceil(entries / squads / lanes));

  const notes: string[] = [];
  const availableMinutes = Math.round(inputs.hours * 60) - OVERHEAD_MIN;

  const timeIsTight = availableMinutes < 240;
  const useBaker = entrySize >= 4 && timeIsTight;
  const scoringMode: ScoringMode = useBaker ? "baker" : "individual";
  if (useBaker) {
    notes.push(
      "Baker scoring recommended — a Baker game runs about a fifth the length of a full team game, which is what makes this fit your window.",
    );
  }

  const minutesPerGame =
    scoringMode === "baker"
      ? entriesPerLane * MIN_PER_GAME_PER_BOWLER
      : bowlersPerLane * MIN_PER_GAME_PER_BOWLER;

  const format: "handicap" | "scratch" =
    inputs.skillSpread === "wide" ? "handicap" : "scratch";

  const finals: PlannedStage[] = [];

  if (inputs.finishStyle === "dramatic") {
    const ladderSize = entries >= 8 ? 5 : 3;
    finals.push({
      name: "Stepladder Finals",
      stage_type: "stepladder",
      scoring_mode: scoringMode,
      games: null,
      cut_per_game: null,
      advance_count: ladderSize,
      advance_rule: "match_wins",
      bonus_pins_per_win: 0,
      carry_pins: false,
      estimated_minutes: (ladderSize - 1) * 12,
      blurb: `Top ${ladderSize} seeds. Lowest two bowl, winner moves up the ladder until someone beats the #1 seed.`,
    });
  } else if (inputs.finishStyle === "head_to_head") {
    if (entries <= 12) {
      const n = Math.min(8, entries);
      finals.push({
        name: "Round Robin Match Play",
        stage_type: "round_robin",
        scoring_mode: scoringMode,
        games: n - 1,
        cut_per_game: null,
        advance_count: null,
        advance_rule: "pins_plus_bonus",
        bonus_pins_per_win: 30,
        carry_pins: true,
        estimated_minutes: (n - 1) * minutesPerGame,
        blurb: `Everyone bowls everyone. 30 bonus pins per win added to pinfall — the standard convention.`,
      });
    } else {
      const seeds = Math.min(16, largestPowerOfTwo(entries));
      const rounds = Math.round(Math.log2(seeds));
      finals.push({
        name: "Single Elimination Bracket",
        stage_type: "bracket",
        scoring_mode: scoringMode,
        games: null,
        cut_per_game: null,
        advance_count: seeds,
        advance_rule: "match_wins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        estimated_minutes: rounds * 14,
        blurb: `Top ${seeds} seeded into a bracket. ${rounds} rounds of head-to-head, one game per match.`,
      });
    }
  }

  const finalsMinutes = finals.reduce((s, f) => s + f.estimated_minutes, 0);
  const stages: PlannedStage[] = [];

  if (inputs.finishStyle === "survivor") {
    const games = overrideGames ?? 6;
    const cut = Math.max(1, Math.ceil((entries - 4) / Math.max(1, games - 1)));
    stages.push({
      name: "Eliminator",
      stage_type: "eliminator",
      scoring_mode: scoringMode,
      games,
      cut_per_game: cut,
      advance_count: 4,
      advance_rule: "total_pins",
      bonus_pins_per_win: 0,
      carry_pins: false,
      estimated_minutes: squads * games * minutesPerGame,
      blurb: `Everyone bowls. The bottom ${cut} are cut after each game until 4 remain.`,
    });
  } else {
    const budget = availableMinutes - finalsMinutes;
    const perGame = squads * minutesPerGame;
    const fitted = Math.floor(budget / Math.max(1, perGame));
    const games = overrideGames ?? Math.min(8, Math.max(3, fitted));
    const advance =
      finals.length > 0 ? (finals[0].advance_count ?? Math.min(8, entries)) : null;

    stages.push({
      name: "Qualifying",
      stage_type: "qualifying",
      scoring_mode: scoringMode,
      games,
      cut_per_game: null,
      advance_count: advance,
      advance_rule: "total_pins",
      bonus_pins_per_win: 0,
      carry_pins: false,
      estimated_minutes: squads * games * minutesPerGame,
      blurb:
        finals.length > 0
          ? `${games} games, total pinfall. Top ${advance} advance.`
          : `${games} games, total pinfall. Highest total wins.`,
    });
  }

  stages.push(...finals);

  const totalMinutes =
    stages.reduce((s, st) => s + st.estimated_minutes, 0) + OVERHEAD_MIN;
  const fits = totalMinutes <= Math.round(inputs.hours * 60);

  if (bowlersPerLane > 6) {
    notes.push(
      `${bowlersPerLane} bowlers per lane is crowded — pace will drag. More lanes or another squad would help.`,
    );
  }
  if (squads > 1) {
    notes.push(
      `${bowlers} bowlers on ${lanes} lanes means ${squads} squads bowling in shifts, which is why the estimate is longer than one block of games.`,
    );
  }
  if (!fits) {
    notes.push(
      `This runs about ${Math.round((totalMinutes / 60) * 10) / 10} hours against your ${inputs.hours}-hour window. Drop a qualifying game or add lanes.`,
    );
  }
  if (format === "handicap") {
    notes.push(
      "Handicap keeps a wide-average field competitive. Each entry's handicap locks at entry time so the leaderboard doesn't shift mid-event.",
    );
  }

  return {
    format,
    stages,
    squads,
    bowlersPerLane,
    qualifyingGames: stages[0]?.games ?? 0,
    totalMinutes,
    availableMinutes,
    fits,
    notes,
  };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}
