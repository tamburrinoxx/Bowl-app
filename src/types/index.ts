export type Role = "bowler" | "host" | "admin";
export type TournamentFormat = "handicap" | "scratch";
export type EventType = "singles" | "doubles" | "team" | "baker";
export type TournamentStatus = "draft" | "open" | "in_progress" | "completed";
export type VerificationStatus = "pending" | "verified" | "flagged";
export type EntryType = "single" | "doubles" | "team";

export interface Profile {
  id: string;
  bowl_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  home_center: string | null;
  usbc_id: string | null;
  role: Role;
}

export interface OilPattern {
  id: string;
  name: string;
  source: "house" | "usbc_named" | "kegel_named" | "custom";
  distance_ft: number | null;
  volume_ml: number | null;
  ratio: string | null;
  notes: string | null;
}

export interface PatternAverage {
  id: string;
  bowler_id: string;
  oil_pattern_id: string;
  games_counted: number;
  pins_total: number;
  average: number;
  verified: boolean;
}

export interface Tournament {
  id: string;
  host_id: string;
  name: string;
  format: TournamentFormat;
  event_type: EventType;
  oil_pattern_id: string | null;
  center_name: string | null;
  entry_fee: number | null;
  prize_fund: number | null;
  entry_size: number;
  cashers_ratio: number;
  handicap_base: number;
  handicap_percent: number;
  games_per_squad: number;
  status: TournamentStatus;
  starts_at: string | null;
  check_in_locked: boolean | null;
  show_ticker: boolean | null;
  is_ryder: boolean | null;
}

export interface Squad {
  id: string;
  tournament_id: string;
  label: string;
  starts_at: string | null;
  lane_range: string | null;
}

export interface Entry {
  lane: number | null;
  id: string;
  tournament_id: string;
  squad_id: string | null;
  entry_name: string;
  entry_type: EntryType;
  locked_average: number | null;
  locked_handicap: number | null;
  verification_status: VerificationStatus;
  paid: boolean | null;
}

export interface Game {
  id: string;
  entry_id: string;
  bowler_id: string | null;
  game_number: number;
  scratch_score: number;
  verified: boolean;
}

export interface Session {
  id: string;
  bowler_id: string;
  label: string;
  oil_pattern_id: string | null;
  played_at: string;
  created_at: string;
}

export interface SessionGame {
  id: string;
  session_id: string;
  game_number: number;
  frame_data: { rolls: number[] }[];
  scratch_score: number;
}

export interface BowlerNote {
  id: string;
  bowler_id: string;
  content: string;
  done: boolean;
  created_at: string;
}

export interface StandingsRow {
  entry_id: string;
  tournament_id: string;
  entry_name: string;
  locked_handicap: number | null;
  verification_status: VerificationStatus;
  games_played: number;
  scratch_total: number;
  handicap_total: number;
}

export type StageType =
  | "qualifying"
  | "eliminator"
  | "round_robin"
  | "bracket"
  | "stepladder";

export type ScoringMode = "individual" | "baker";

export type AdvanceRule = "total_pins" | "pins_plus_bonus" | "match_wins";

export interface TournamentStage {
  id: string;
  tournament_id: string;
  stage_number: number;
  name: string;
  stage_type: StageType;
  scoring_mode: ScoringMode;
  games: number | null;
  cut_per_game: number | null;
  advance_count: number | null;
  advance_rule: AdvanceRule;
  bonus_pins_per_win: number;
  carry_pins: boolean;
}

export interface StageStandingsRow {
  stage_id: string | null;
  entry_id: string;
  tournament_id: string;
  entry_name: string;
  locked_handicap: number | null;
  games_played: number;
  scratch_total: number;
  handicap_total: number;
}
