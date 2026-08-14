-- ============================================================
-- BOWL PLATFORM SCHEMA
-- Tier 1: Tournament hosting/scoring + pattern-aware handicaps
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- USERS / BOWLERS ----------
-- Extends Supabase auth.users with bowling-specific profile data
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  home_center text,
  usbc_id text,
  role text not null default 'bowler' check (role in ('bowler', 'host', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- OIL PATTERNS ----------
create table oil_patterns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                  -- e.g. "Cheetah", "Kegel Main Street", "Plum Brook House"
  source text not null default 'house' check (source in ('house', 'usbc_named', 'kegel_named', 'custom')),
  distance_ft numeric,                 -- pattern length
  volume_ml numeric,
  ratio text,                          -- e.g. "8:1"
  forward_ratio text,
  reverse_ratio text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- PATTERN AVERAGES (the pattern-aware handicap core) ----------
-- One row per bowler per pattern. This is what "handicap on this specific
-- pattern" actually means -- separate rolling averages instead of one
-- blended number across every condition a bowler has ever played.
create table pattern_averages (
  id uuid primary key default uuid_generate_v4(),
  bowler_id uuid not null references profiles(id) on delete cascade,
  oil_pattern_id uuid not null references oil_patterns(id) on delete cascade,
  games_counted int not null default 0,
  pins_total int not null default 0,
  average numeric generated always as (
    case when games_counted > 0 then round(pins_total::numeric / games_counted, 2) else 0 end
  ) stored,
  verified boolean not null default false,
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (bowler_id, oil_pattern_id)
);

-- ---------- TOURNAMENTS ----------
create table tournaments (
  id uuid primary key default uuid_generate_v4(),
  host_id uuid not null references profiles(id),
  name text not null,
  format text not null check (format in ('handicap', 'scratch')),
  event_type text not null check (event_type in ('singles', 'doubles', 'team', 'baker')),
  oil_pattern_id uuid references oil_patterns(id),
  center_name text,
  entry_fee numeric,
  prize_fund numeric,
  handicap_base int default 220,       -- e.g. 220 base, 90% factor -- standard convention
  handicap_percent numeric default 0.9,
  games_per_squad int not null default 3,
  status text not null default 'draft' check (status in ('draft', 'open', 'in_progress', 'completed')),
  starts_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- SQUADS (sessions within a tournament) ----------
create table squads (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  label text not null,                 -- e.g. "Squad A - 9:00 AM"
  starts_at timestamptz,
  lane_range text                      -- e.g. "1-12"
);

-- ---------- ENTRIES ----------
-- Handicap is snapshotted at entry time from the bowler's pattern_average
-- for this tournament's oil pattern, so a live bracket/leaderboard doesn't
-- shift under people mid-event as their rolling average updates elsewhere.
create table entries (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  squad_id uuid references squads(id),
  entry_name text not null,            -- team/doubles name or bowler name
  entry_type text not null check (entry_type in ('single', 'doubles', 'team')),
  locked_average numeric,              -- snapshot at entry time
  locked_handicap numeric,             -- snapshot at entry time
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'flagged')),
  verified_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Links bowlers to an entry (supports singles/doubles/team without separate tables)
create table entry_bowlers (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references entries(id) on delete cascade,
  bowler_id uuid not null references profiles(id),
  position int default 1               -- lineup order for team events
);

-- ---------- GAMES ----------
create table games (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references entries(id) on delete cascade,
  bowler_id uuid references profiles(id),   -- null for team-total-only games
  game_number int not null,
  scratch_score int not null check (scratch_score between 0 and 300),
  entered_by uuid references profiles(id),
  verified boolean not null default false,
  verified_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (entry_id, bowler_id, game_number)
);

-- ---------- STANDINGS (materialized via view, not a stored table) ----------
create view standings as
select
  e.id as entry_id,
  e.tournament_id,
  e.entry_name,
  e.locked_handicap,
  e.verification_status,
  count(g.id) as games_played,
  coalesce(sum(g.scratch_score), 0) as scratch_total,
  coalesce(sum(g.scratch_score), 0) + (coalesce(e.locked_handicap, 0) * count(g.id)) as handicap_total
from entries e
left join games g on g.entry_id = e.id
group by e.id, e.tournament_id, e.entry_name, e.locked_handicap, e.verification_status;

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table pattern_averages enable row level security;
alter table tournaments enable row level security;
alter table entries enable row level security;
alter table entry_bowlers enable row level security;
alter table games enable row level security;

-- Profiles: bowlers see/edit their own; hosts/admins see all
create policy "profiles_self_read" on profiles for select using (true);
create policy "profiles_self_update" on profiles for update using (auth.uid() = id);

-- Tournaments: public read, host manages own
create policy "tournaments_public_read" on tournaments for select using (true);
create policy "tournaments_host_write" on tournaments for insert with check (auth.uid() = host_id);
create policy "tournaments_host_update" on tournaments for update using (auth.uid() = host_id);

-- Entries/games: public read (leaderboards), host of the tournament can write
create policy "entries_public_read" on entries for select using (true);
create policy "games_public_read" on games for select using (true);

create policy "entries_host_write" on entries for insert with check (
  exists (select 1 from tournaments t where t.id = tournament_id and t.host_id = auth.uid())
);
create policy "games_host_write" on games for insert with check (
  exists (
    select 1 from entries e
    join tournaments t on t.id = e.tournament_id
    where e.id = entry_id and t.host_id = auth.uid()
  )
);

-- Pattern averages: bowler can read own, host/admin can verify (update)
create policy "pattern_avg_read" on pattern_averages for select using (true);
create policy "pattern_avg_self_write" on pattern_averages for insert with check (auth.uid() = bowler_id);
