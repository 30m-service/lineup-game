// Vercel Serverless Function — 장 마감 결과 자동 채점
// 배포 경로: /api/settle-results
// Vercel Cron에서만 호출되도록 Authorization: Bearer $CRON_SECRET 헤더를 검증한다.
// Supabase Service Role Key로 RLS를 우회해 모든 사용자의 예측을 업데이트한다.
import { fetchNaverPrices } from './_lib/naver.js';

const SUPABASE_URL = 'https://cdlplhomkrwnybedesgz.supabase.co';

function getKstDateStr() {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않음');
    return res.status(500).json({ ok: false, error: 'Server misconfigured' });
  }

  const sbHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  try {
    const today = getKstDateStr();

    // 1. 오늘 날짜 · 미채점 예측 조회
    const listUrl = `${SUPABASE_URL}/rest/v1/lineup_predictions`
      + `?trade_date=eq.${today}&actual_close_price=is.null`
      + `&select=id,stock_code,bat_choice,pitcher_price,base_close_price`;
    const listRes = await fetch(listUrl, { headers: sbHeaders });
    if (!listRes.ok) throw new Error(`Supabase 조회 오류: ${listRes.status}`);
    const predictions = await listRes.json();

    // 주말 등 오늘자 예측이 없으면 조용히 종료 (에러 아님)
    if (!predictions.length) {
      return res.status(200).json({ ok: true, date: today, settled: 0, message: '정산할 예측이 없습니다' });
    }

    // 2. 관련 종목 실제 종가 조회 (기존 api/prices.js와 동일한 로직 재사용)
    const codes = [...new Set(predictions.map(p => p.stock_code))];
    const prices = await fetchNaverPrices(codes);

    // 3. 종목별 채점 후 업데이트
    let settled = 0;
    const failures = [];

    for (const p of predictions) {
      const actual = prices[p.stock_code];
      if (actual == null) {
        failures.push({ id: p.id, stock_code: p.stock_code, reason: '실시간 종가 없음' });
        continue;
      }

      const update = { actual_close_price: actual };

      if (p.bat_choice) {
        const pct = ((actual - p.base_close_price) / p.base_close_price) * 100;
        const result = pct >= 1 ? 'up' : pct <= -1 ? 'down' : 'flat';
        update.is_hit = result === p.bat_choice;
      }

      if (p.pitcher_price != null) {
        update.era_value = parseFloat((Math.abs(p.pitcher_price - actual) / actual * 100).toFixed(3));
      }

      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/lineup_predictions?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(update),
      });

      if (!patchRes.ok) {
        failures.push({ id: p.id, stock_code: p.stock_code, reason: `업데이트 실패 ${patchRes.status}` });
        continue;
      }
      settled++;
    }

    res.status(200).json({ ok: true, date: today, total: predictions.length, settled, failures });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
