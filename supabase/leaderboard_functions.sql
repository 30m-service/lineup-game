-- 종목 라인업 / 올스타 탭을 실제 lineup_predictions 데이터로 집계하기 위한 함수.
-- RLS는 "본인 row만" 허용하므로, 랭킹처럼 전체 유저를 집계해야 하는 조회는
-- SECURITY DEFINER 함수로 RLS를 우회하되, 원본 row가 아닌 "집계 결과"만 반환한다
-- (개별 예측 선택 내역은 여전히 비공개로 유지됨).
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
  having count(*) >= 10
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
  having count(*) >= 10
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
  having count(*) >= 10
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
  having count(*) >= 10
  order by avg(p.era_value) asc
  limit 5;
$$;

grant execute on function lineup_stock_batters(text) to anon, authenticated;
grant execute on function lineup_stock_pitchers(text) to anon, authenticated;
grant execute on function lineup_allstar_batters() to anon, authenticated;
grant execute on function lineup_allstar_pitchers() to anon, authenticated;
