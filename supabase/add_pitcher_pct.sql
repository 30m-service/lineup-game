-- 투수 모드를 등락률 콤보박스로 변경하면서 추가되는 컬럼
-- Supabase SQL Editor에서 실행하세요.
alter table lineup_predictions add column pitcher_pct numeric;
