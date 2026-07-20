-- 닉네임 대소문자 구분 없이 중복 불가 (NULL은 서로 중복으로 취급되지 않음 — 미설정 유저끼리는 충돌 없음)
-- Supabase SQL Editor에서 실행하세요.
create unique index lineup_users_nickname_unique_ci on lineup_users (lower(nickname));
