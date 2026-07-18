// Vercel Serverless Function — 네이버 증권 API 프록시
// 배포 경로: /api/prices
import { fetchNaverPrices } from './_lib/naver.js';

export default async function handler(req, res) {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const CODES = [
    '005930','000660','005380','035420','051910',
    '006400','035720','028260','207940','005490'
  ];

  try {
    const prices = await fetchNaverPrices(CODES);
    res.status(200).json({ ok: true, prices, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
