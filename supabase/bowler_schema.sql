-- ============================================================
-- BOWLER-FACING: self-logged sessions, frame-level scoring, notes
-- ============================================================

-- A bowler-logged practice/league session (independent of host tournaments)
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  bowler_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  oil_pattern_id uuid references oil_patterns(id),
  played_at date not null default current_date,
  created_at timestamptz not null default now()
);

-- One row per game (1-3) within a session, storing full frame-by-frame data
create table session_games (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  game_number int not null check (game_number between 1 and 3),
  frame_data jsonb not null,       -- array of { rolls: number[] }, 10 frames
  scratch_score int not null,
  created_at timestamptz not null default now(),
  unique (session_id, game_number)
);

-- Freeform "things to work on" notes a bowler keeps for themselves
create table bowler_notes (
  id uuid primary key default uuid_generate_v4(),
  bowler_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;
alter table session_games enable row level security;
alter table bowler_notes enable row level security;

create policy "sessions_own_all" on sessions
  for all using (auth.uid() = bowler_id) with check (auth.uid() = bowler_id);

create policy "session_games_own_read" on session_games
  for select using (
    exists (select 1 from sessions s where s.id = session_id and s.bowler_id = auth.uid())
  );

create policy "session_games_own_write" on session_games
  for insert with check (
    exists (select 1 from sessions s where s.id = session_id and s.bowler_id = auth.uid())
  );

create policy "session_games_own_update" on session_games
  for update using (
    exists (select 1 from sessions s where s.id = session_id and s.bowler_id = auth.uid())
  );

create policy "bowler_notes_own_all" on bowler_notes
  for all using (auth.uid() = bowler_id) with check (auth.uid() = bowler_id);
