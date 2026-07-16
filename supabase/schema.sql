-- LINE UP: lineup_users / lineup_predictions
-- Supabase SQL Editor에서 실행하세요.
-- 사전 준비: Authentication → Settings → "Allow anonymous sign-ins" 활성화 필요
--           (프론트엔드가 supabase.auth.signInAnonymously()를 사용합니다)

create table if not exists lineup_users (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now()
);

create table if not exists lineup_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lineup_users(id) on delete cascade,
  stock_code text not null,
  trade_date date not null,
  bat_choice text check (bat_choice in ('up','flat','down')),
  pitcher_price numeric,
  base_close_price numeric not null,
  actual_close_price numeric,
  is_hit boolean,
  era_value numeric,
  created_at timestamptz not null default now(),
  unique (user_id, stock_code, trade_date)
);

alter table lineup_users enable row level security;
alter table lineup_predictions enable row level security;

-- lineup_users: 본인 row만 select/insert/update
create policy "lineup_users_select_own" on lineup_users
  for select using (auth.uid() = id);
create policy "lineup_users_insert_own" on lineup_users
  for insert with check (auth.uid() = id);
create policy "lineup_users_update_own" on lineup_users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- lineup_predictions: 본인 user_id row만 select/insert/update
create policy "lineup_predictions_select_own" on lineup_predictions
  for select using (auth.uid() = user_id);
create policy "lineup_predictions_insert_own" on lineup_predictions
  for insert with check (auth.uid() = user_id);
create policy "lineup_predictions_update_own" on lineup_predictions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
