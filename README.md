# LINE UP ↑↓ — 주가 예측 게임

## 배포 방법 (Vercel)

### 1. Vercel CLI 설치
```bash
npm install -g vercel
```

### 2. 프로젝트 배포
```bash
cd lineup-project
vercel
```

### 3. 폴더 구조
```
lineup-project/
├── api/
│   └── prices.js       ← 네이버 증권 주가 프록시 (Vercel이 /api/prices로 자동 인식)
├── public/
│   └── index.html      ← 게임 본체 (Vercel이 정적 루트로 자동 인식)
├── package.json
└── README.md
```

별도 `vercel.json` 없이 Vercel의 zero-config 규칙(루트 `api/`는 서버리스 함수로, `public/`은 정적 루트로)을 사용합니다.

## 실시간 주가 연동 방식

- **데이터 소스**: 네이버 증권 (polling.finance.naver.com)
- **인증**: 불필요 (공개 API)
- **CORS 해결**: Vercel Serverless Function 프록시
- **호출 흐름**: 브라우저 → /api/prices → 네이버 증권 API

## 장 시간 로직

| 상태 | 시간 (KST) | 예측 화면 | 라인업/올스타 |
|------|-----------|----------|------------|
| 장 중 | 평일 09:00~15:30 | 잠금 | 상시 접근 가능 |
| 장 마감 후 | 평일 15:30~ | 활성 (종가 표시) | 상시 접근 가능 |
| 익일 장 전 | 평일 ~09:00 | 활성 (전날 종가) | 상시 접근 가능 |
| 주말 | 토·일 | 휴장 안내 | 상시 접근 가능 |

## 주요 종목 (KOSPI 시총 상위 10)
005930 삼성전자 / 000660 SK하이닉스 / 005380 현대차
035420 NAVER / 051910 LG화학 / 006400 삼성SDI
035720 카카오 / 028260 삼성물산 / 207940 삼성바이오로직스
005490 POSCO홀딩스
