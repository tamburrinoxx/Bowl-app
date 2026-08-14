export type Role = "bowler" | "host" | "admin";
export type TournamentFormat = "handicap" | "scratch";
export type EventType = "singles" | "doubles" | "team" | "baker";
export type TournamentStatus = "draft" | "open" | "in_progress" | "completed";
export type VerificationStatus = "pending" | "verified" | "flagged";
export type EntryType = "single" | "doubles" | "team";

export interface Profile {
  id: string;
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
  handicap_base: number;
  handicap_percent: number;
  games_per_squad: number;
  status: TournamentStatus;
  starts_at: string | null;
}

export interface Squad {
  id: string;
  tournament_id: string;
  label: string;
  starts_at: string | null;
  lane_range: string | null;
}

export interface Entry {
  id: string;
  tournament_id: string;
  squad_id: string | null;
  entry_name: string;
  entry_type: EntryType;
  locked_average: number | null;
  locked_handicap: number | null;
  verification_status: VerificationStatus;
}

export interface Game {
  id: string;
  entry_id: string;
  bowler_id: string | null;
  game_number: number;
  scratch_score: number;
  verified: boolean;
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
