// api/ 하위 _로 시작하는 디렉터리는 Vercel이 라우트로 취급하지 않음 (공유 유틸)
export async function fetchNaverPrices(codes) {
  const url = `https://polling.finance.naver.com/api/realtime/domestic/stock/${codes.join(',')}`;
  const response = await fetch(url, {
    headers: {
      'Referer': 'https://finance.naver.com',
      'User-Agent': 'Mozilla/5.0',
    }
  });

  if (!response.ok) throw new Error(`Naver API error: ${response.status}`);

  const raw = await response.json();
  console.log('Naver raw response:', JSON.stringify(raw));

  const result = {};
  const items = raw.datas || [];
  items.forEach(item => {
    const code = item.itemCode;
    const price = item.closePriceRaw;
    if (code && price) {
      result[code] = parseInt(price, 10);
    }
  });

  return result;
}
