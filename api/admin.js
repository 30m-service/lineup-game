// Vercel Serverless Function — 관리자 API
// 배포 경로: /api/admin
// 환경변수: ADMIN_TOKEN_SECRET, ADMIN_PASSWORD_HASH, SUPABASE_SERVICE_ROLE_KEY
// service_role 키로 RLS를 우회해 모든 유저/예측 데이터를 다룬다.
import { createHmac, createHash, timingSafeEqual } from 'crypto';

const SUPABASE_URL = 'https://cdlplhomkrwnybedesgz.supabase.co';

function sign(expiresAt) {
  return createHmac('sha256', process.env.ADMIN_TOKEN_SECRET)
    .update(String(expiresAt))
    .digest('hex');
}

function makeToken() {
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000; // 12시간 유효
  return `${expiresAt}.${sign(expiresAt)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [expiresAtStr, sig] = token.split('.');
  const expiresAt = Number(expiresAtStr);
  if (!expiresAt || !sig) return false;
  if (Date.now() > expiresAt) return false;
  const expected = sign(expiresAt);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false; // 길이가 다르면 timingSafeEqual이 throw함
  }
}

function hashPassword(pw) {
  return createHash('sha256').update(pw).digest('hex');
}

// 비밀번호 해시 비교도 토큰 검증과 동일하게 타이밍 세이프하게 처리
function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    try { timingSafeEqual(bufA, Buffer.alloc(bufA.length)); } catch {}
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}` };
}

async function sbFetch(path, options = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...sbHeaders(), ...(options.headers || {}) },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { action, token, password } = req.body || {};

  // ---- 로그인 ----
  if (action === 'login') {
    const ok = password && timingSafeStringEqual(hashPassword(password), process.env.ADMIN_PASSWORD_HASH || '');
    if (!ok) {
      // 무차별 대입을 조금이라도 늦추기 위한 지연 (완전한 rate limit은 아님)
      await new Promise(r => setTimeout(r, 800));
      return res.status(401).json({ error: '비밀번호가 틀렸습니다' });
    }
    return res.status(200).json({ token: makeToken() });
  }

  // ---- 로그인 이후 모든 action은 토큰 필요 ----
  if (!verifyToken(token)) {
    return res.status(401).json({ error: '인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.' });
  }

  try {
    // ---- 1. 유저/닉네임 관리 ----
    if (action === 'users') {
      const usersRes = await sbFetch('/rest/v1/lineup_users?select=id,nickname,created_at&order=created_at.desc');
      if (!usersRes.ok) throw new Error(`lineup_users 조회 실패: ${usersRes.status}`);
      const lineupUsers = await usersRes.json();

      const authRes = await sbFetch('/auth/v1/admin/users?per_page=1000');
      if (!authRes.ok) throw new Error(`auth 유저 조회 실패: ${authRes.status}`);
      const authJson = await authRes.json();
      const authList = Array.isArray(authJson) ? authJson : (authJson.users || []);

      const emailMap = {};
      authList.forEach(u => { emailMap[u.id] = u.email || null; });

      const merged = lineupUsers.map(u => ({ ...u, email: emailMap[u.id] || null }));
      return res.status(200).json({ users: merged });
    }

    if (action === 'update_nickname') {
      const { userId, nickname } = req.body;
      const r = await sbFetch(`/rest/v1/lineup_users?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ nickname }),
      });
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}));
        if (errBody.code === '23505') {
          return res.status(409).json({ error: '이미 사용 중인 닉네임입니다' });
        }
        throw new Error(errBody.message || `닉네임 업데이트 실패: ${r.status}`);
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete_user') {
      const { userId } = req.body;
      const uid = encodeURIComponent(userId);
      await sbFetch(`/rest/v1/lineup_predictions?user_id=eq.${uid}`, { method: 'DELETE' });
      await sbFetch(`/rest/v1/lineup_users?id=eq.${uid}`, { method: 'DELETE' });
      // auth.users까지 지워야 이메일이 영구히 "이미 등록됨" 상태로 남지 않는다
      const authDel = await sbFetch(`/auth/v1/admin/users/${uid}`, { method: 'DELETE' });
      if (!authDel.ok && authDel.status !== 404) {
        console.error('auth 유저 삭제 실패:', authDel.status, await authDel.text());
      }
      return res.status(200).json({ ok: true });
    }

    // ---- 2. 예측 데이터 조회 ----
    if (action === 'predictions') {
      const { stock_code, trade_date } = req.body;
      let path = '/rest/v1/lineup_predictions?select=*&order=trade_date.desc&limit=500';
      if (stock_code) path += `&stock_code=eq.${encodeURIComponent(stock_code)}`;
      if (trade_date) path += `&trade_date=eq.${encodeURIComponent(trade_date)}`;
      const r = await sbFetch(path);
      if (!r.ok) throw new Error(`예측 조회 실패: ${r.status}`);
      const data = await r.json();
      return res.status(200).json({ predictions: data });
    }

    // ---- 3. 채점 상태 모니터링 ----
    if (action === 'settlement') {
      const r = await sbFetch('/rest/v1/lineup_predictions?select=trade_date,actual_close_price');
      if (!r.ok) throw new Error(`채점 상태 조회 실패: ${r.status}`);
      const data = await r.json();

      const byDate = {};
      data.forEach(row => {
        if (!byDate[row.trade_date]) byDate[row.trade_date] = { total: 0, settled: 0 };
        byDate[row.trade_date].total++;
        if (row.actual_close_price !== null) byDate[row.trade_date].settled++;
      });

      const result = Object.entries(byDate)
        .map(([trade_date, v]) => ({
          trade_date,
          total: v.total,
          settled: v.settled,
          unsettled: v.total - v.settled,
        }))
        .sort((a, b) => b.trade_date.localeCompare(a.trade_date));

      return res.status(200).json({ settlement: result });
    }

    return res.status(400).json({ error: '알 수 없는 action입니다: ' + action });
  } catch (err) {
    console.error('admin api error:', err);
    return res.status(500).json({ error: err.message });
  }
}
