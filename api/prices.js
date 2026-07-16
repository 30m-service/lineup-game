// Vercel Serverless Function — 네이버 증권 API 프록시
// 배포 경로: /api/prices
export default async function handler(req, res) {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const CODES = [
    '005930','000660','005380','035420','051910',
    '006400','035720','028260','207940','005490'
  ];

  try {
    const url = `https://polling.finance.naver.com/api/realtime/domestic/stock/${CODES.join(',')}`;
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://finance.naver.com',
        'User-Agent': 'Mozilla/5.0',
      }
    });

    if (!response.ok) throw new Error(`Naver API error: ${response.status}`);

    const raw = await response.json();
    console.log('Naver raw response:', JSON.stringify(raw));

    // 응답 파싱: datas 배열에서 종목코드 → 현재가 매핑
    const result = {};
    const items = raw.datas || [];
    items.forEach(item => {
      const code = item.itemCode;
      const price = item.closePriceRaw;
      if (code && price) {
        result[code] = parseInt(price, 10);
      }
    });

    res.status(200).json({ ok: true, prices: result, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
