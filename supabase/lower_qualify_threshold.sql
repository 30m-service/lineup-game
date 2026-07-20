-- 라인업/올스타 자격 기준을 10회 -> 3회로 완화.
-- create or replace이므로 기존 함수를 덮어쓰며, 부여된 grant는 유지된다.
-- Supabase SQL Editor에서 실행하세요.

create or replace function lineup_stock_batters(p_stock_code text)
returns table (user_id uuid, nickname text, plays bigint, hits bigint)
language sql security definer set search_path = public as $$
  select p.user_id, u.nickname, count(*) as plays,
         count(*) filter (where p.is_hit) as hits
  from lineup_predictions p
  join lineup_users u on u.id = p.user_id
  where p.stock_code = p_stock_code and p.is_hit is not null
  group by p.user_id, u.nickname
  having count(*) >= 3
  order by (count(*) filter (where p.is_hit))::numeric / count(*) desc
  limit 9;
$$;

create or replace function lineup_stock_pitchers(p_stock_code text)
returns table (user_id uuid, nickname text, plays bigint, avg_era numeric)
language sql security definer set search_path = public as $$
  select p.user_id, u.nickname, count(*) as plays,
         round(avg(p.era_value), 3) as avg_era
  from lineup_predictions p
  join lineup_users u on u.id = p.user_id
  where p.stock_code = p_stock_code and p.era_value is not null
  group by p.user_id, u.nickname
  having count(*) >= 3
  order by avg(p.era_value) asc
  limit 5;
$$;

create or replace function lineup_allstar_batters()
returns table (user_id uuid, nickname text, plays bigint, hits bigint)
language sql security definer set search_path = public as $$
  select p.user_id, u.nickname, count(*) as plays,
         count(*) filter (where p.is_hit) as hits
  from lineup_predictions p
  join lineup_users u on u.id = p.user_id
  where p.is_hit is not null
  group by p.user_id, u.nickname
  having count(*) >= 3
  order by (count(*) filter (where p.is_hit))::numeric / count(*) desc
  limit 9;
$$;

create or replace function lineup_allstar_pitchers()
returns table (user_id uuid, nickname text, plays bigint, avg_era numeric)
language sql security definer set search_path = public as $$
  select p.user_id, u.nickname, count(*) as plays,
         round(avg(p.era_value), 3) as avg_era
  from lineup_predictions p
  join lineup_users u on u.id = p.user_id
  where p.era_value is not null
  group by p.user_id, u.nickname
  having count(*) >= 3
  order by avg(p.era_value) asc
  limit 5;
$$;
