import {
  estimateTiming,
  type FormatPlan,
  type PlannedStage,
} from "@/lib/formats";
import type { AdvanceRule, ScoringMode, StageType } from "@/types";

export interface PresetStage {
  name: string;
  stage_type: StageType;
  scoring_mode: ScoringMode;
  games: number | null;
  cut_per_game: number | null;
  advance_count: number | null;
  advance_rule: AdvanceRule;
  bonus_pins_per_win: number;
  carry_pins: boolean;
  blurb: string;
  fixed_minutes?: number;
}

export interface FormatPreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  entrySize: number;
  format: "handicap" | "scratch";
  suggestedEntries: number;
  suggestedHours: number;
  stages: PresetStage[];
  caveat?: string;
}

export const FORMAT_PRESETS: FormatPreset[] = [
  {
    id: "handicap_sweeper",
    name: "Handicap Sweeper",
    tagline: "3 games, highest total wins",
    description:
      "The workhorse. Everyone bowls three games, handicap levels the field, high total takes it. No cuts, no finals, done in an afternoon.",
    entrySize: 1,
    format: "handicap",
    suggestedEntries: 24,
    suggestedHours: 3,
    stages: [
      {
        name: "Qualifying",
        stage_type: "qualifying",
        scoring_mode: "individual",
        games: 3,
        cut_per_game: null,
        advance_count: null,
        advance_rule: "total_pins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        blurb: "3 games, handicap total pinfall. Highest total wins outright.",
      },
    ],
  },
  {
    id: "scratch_masters",
    name: "Scratch Masters",
    tagline: "6 games, top 5 stepladder",
    description:
      "Serious scratch event. Six qualifying games sorts the field, then the top five bowl a stepladder finish in front of whoever's still watching.",
    entrySize: 1,
    format: "scratch",
    suggestedEntries: 32,
    suggestedHours: 6,
    stages: [
      {
        name: "Qualifying",
        stage_type: "qualifying",
        scoring_mode: "individual",
        games: 6,
        cut_per_game: null,
        advance_count: 5,
        advance_rule: "total_pins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        blurb: "6 games scratch, total pinfall. Top 5 advance.",
      },
      {
        name: "Stepladder Finals",
        stage_type: "stepladder",
        scoring_mode: "individual",
        games: null,
        cut_per_game: null,
        advance_count: 5,
        advance_rule: "match_wins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        fixed_minutes: 48,
        blurb: "4 vs 5, winner faces 3, then 2, then the top seed.",
      },
    ],
  },
  {
    id: "pba_style",
    name: "PBA-Style Match Play",
    tagline: "Qualify, round robin, stepladder",
    description:
      "The full three-stage treatment. Eight games to qualify, top 16 bowl round robin with 30 bonus pins per win, then a five-person stepladder. This is a long day.",
    entrySize: 1,
    format: "scratch",
    suggestedEntries: 40,
    suggestedHours: 9,
    stages: [
      {
        name: "Qualifying",
        stage_type: "qualifying",
        scoring_mode: "individual",
        games: 8,
        cut_per_game: null,
        advance_count: 16,
        advance_rule: "total_pins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        blurb: "8 games scratch. Top 16 advance to match play.",
      },
      {
        name: "Round Robin Match Play",
        stage_type: "round_robin",
        scoring_mode: "individual",
        games: 15,
        cut_per_game: null,
        advance_count: 5,
        advance_rule: "pins_plus_bonus",
        bonus_pins_per_win: 30,
        carry_pins: true,
        blurb: "Everyone bowls everyone. 30 bonus pins per win, pinfall carries.",
      },
      {
        name: "Stepladder Finals",
        stage_type: "stepladder",
        scoring_mode: "individual",
        games: null,
        cut_per_game: null,
        advance_count: 5,
        advance_rule: "match_wins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        fixed_minutes: 48,
        blurb: "Top 5 from match play. Ladder to the title.",
      },
    ],
  },
  {
    id: "baker_team",
    name: "Baker Team Battle",
    tagline: "Fast team format, bracket finish",
    description:
      "Five bowlers share one game — bowler 1 takes frames 1 and 6, bowler 2 takes 2 and 7, and so on. Fast, loud, and forces the whole team to matter. Top 8 into a bracket.",
    entrySize: 5,
    format: "handicap",
    suggestedEntries: 16,
    suggestedHours: 3,
    stages: [
      {
        name: "Baker Qualifying",
        stage_type: "qualifying",
        scoring_mode: "baker",
        games: 5,
        cut_per_game: null,
        advance_count: 8,
        advance_rule: "total_pins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        blurb: "5 Baker games. Top 8 teams advance.",
      },
      {
        name: "Baker Bracket",
        stage_type: "bracket",
        scoring_mode: "baker",
        games: null,
        cut_per_game: null,
        advance_count: 8,
        advance_rule: "match_wins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        fixed_minutes: 42,
        blurb: "8 teams, single elimination, one Baker game per match.",
      },
    ],
  },
  {
    id: "eliminator",
    name: "Last One Standing",
    tagline: "Cut the bottom every game",
    description:
      "Everyone bowls a game, the bottom finishers go home, repeat. Tension builds every frame because the cut line is visible the whole time. Great spectator format.",
    entrySize: 1,
    format: "handicap",
    suggestedEntries: 32,
    suggestedHours: 4,
    stages: [
      {
        name: "Eliminator",
        stage_type: "eliminator",
        scoring_mode: "individual",
        games: 6,
        cut_per_game: 5,
        advance_count: 2,
        advance_rule: "total_pins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        blurb: "Bottom 5 cut after each game until two remain for a final game.",
      },
    ],
  },
  {
    id: "doubles_shootout",
    name: "Doubles Shootout",
    tagline: "Partners, 4 games, top 4 ladder",
    description:
      "Two-person teams, combined handicap scores across four games, then the top four pairs bowl a short stepladder. Good for a mixed crowd where people want a partner.",
    entrySize: 2,
    format: "handicap",
    suggestedEntries: 16,
    suggestedHours: 4,
    stages: [
      {
        name: "Qualifying",
        stage_type: "qualifying",
        scoring_mode: "individual",
        games: 4,
        cut_per_game: null,
        advance_count: 4,
        advance_rule: "total_pins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        blurb: "4 games, combined handicap pinfall. Top 4 pairs advance.",
      },
      {
        name: "Stepladder Finals",
        stage_type: "stepladder",
        scoring_mode: "individual",
        games: null,
        cut_per_game: null,
        advance_count: 4,
        advance_rule: "match_wins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        fixed_minutes: 36,
        blurb: "3 vs 4, winner faces 2, then the top seed.",
      },
    ],
  },
  {
    id: "king_of_hill",
    name: "King of the Hill",
    tagline: "Short qualify, big bracket",
    description:
      "Three games just to seed people, then everything rides on head-to-head brackets. Qualifying barely matters, which keeps late arrivals and weak starters in it.",
    entrySize: 1,
    format: "handicap",
    suggestedEntries: 32,
    suggestedHours: 4,
    stages: [
      {
        name: "Seeding Round",
        stage_type: "qualifying",
        scoring_mode: "individual",
        games: 3,
        cut_per_game: null,
        advance_count: 16,
        advance_rule: "total_pins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        blurb: "3 games to set the bracket. Top 16 seeded.",
      },
      {
        name: "Single Elimination Bracket",
        stage_type: "bracket",
        scoring_mode: "individual",
        games: null,
        cut_per_game: null,
        advance_count: 16,
        advance_rule: "match_wins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        fixed_minutes: 56,
        blurb: "16 seeds, 4 rounds, one game per match. Lose and you're out.",
      },
    ],
  },
  {
    id: "no_tap_charity",
    name: "9-Pin No-Tap Charity",
    tagline: "Everyone scores, nobody complains",
    description:
      "Nine pins on the first ball counts as a strike. Scores jump, beginners keep up with regulars, and the room stays loud. The go-to for fundraisers and corporate nights.",
    entrySize: 4,
    format: "handicap",
    suggestedEntries: 12,
    suggestedHours: 3,
    caveat:
      "No-tap scoring isn't enforced by the app yet — you'd score it manually. Everything else works.",
    stages: [
      {
        name: "No-Tap Qualifying",
        stage_type: "qualifying",
        scoring_mode: "individual",
        games: 3,
        cut_per_game: null,
        advance_count: null,
        advance_rule: "total_pins",
        bonus_pins_per_win: 0,
        carry_pins: false,
        blurb: "3 games, 9-pin no-tap, handicap total. Highest team total wins.",
      },
    ],
  },
];

/** Cost a preset's fixed stage list against a real venue. */
export function planPreset(
  preset: FormatPreset,
  venue: { entries: number; lanes: number; hours: number },
): FormatPlan {
  const t = estimateTiming({
    entrySize: preset.entrySize,
    entries: venue.entries,
    lanes: venue.lanes,
  });

  const stages: PlannedStage[] = preset.stages.map((s) => {
    const perGame =
      s.scoring_mode === "baker" ? t.minutesPerBakerGame : t.minutesPerGame;
    const estimated =
      s.fixed_minutes ?? (s.games ? t.squads * s.games * perGame : 30);
    return { ...s, estimated_minutes: estimated };
  });

  const totalMinutes =
    stages.reduce((sum, s) => sum + s.estimated_minutes, 0) + t.overheadMin;
  const fits = totalMinutes <= Math.round(venue.hours * 60);

  const notes: string[] = [];
  if (preset.caveat) notes.push(preset.caveat);
  if (t.bowlersPerLane > 6) {
    notes.push(`${t.bowlersPerLane} bowlers per lane is crowded — pace will drag.`);
  }
  if (t.squads > 1) {
    notes.push(
      `${venue.entries * preset.entrySize} bowlers on ${venue.lanes} lanes means ${t.squads} squads in shifts.`,
    );
  }
  if (!fits) {
    notes.push(
      `This runs about ${Math.round((totalMinutes / 60) * 10) / 10} hours against your ${venue.hours}-hour window.`,
    );
  }

  return {
    format: preset.format,
    stages,
    squads: t.squads,
    bowlersPerLane: t.bowlersPerLane,
    qualifyingGames: stages[0]?.games ?? 0,
    totalMinutes,
    availableMinutes: Math.round(venue.hours * 60) - t.overheadMin,
    fits,
    notes,
  };
}
