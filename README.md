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
│   ├── _lib/naver.js       ← 네이버 증권 API 호출 공통 로직 (라우트 아님, prices/settle-results가 공유)
│   ├── prices.js           ← 네이버 증권 주가 프록시 (/api/prices)
│   └── settle-results.js   ← 장 마감 결과 자동 채점 (/api/settle-results, Vercel Cron 전용)
├── public/
│   └── index.html          ← 게임 본체 (Vercel이 정적 루트로 자동 인식)
├── supabase/schema.sql     ← 테이블/RLS 정의 (Supabase SQL Editor에서 실행)
├── vercel.json              ← Cron 스케줄 설정
├── package.json
└── README.md
```

`api/`, `public/`은 Vercel의 zero-config 규칙(루트 `api/`는 서버리스 함수로, `public/`은 정적 루트로)을 그대로 사용합니다. `vercel.json`은 Cron 스케줄 설정만을 위해 존재합니다.

### 4. 필요한 환경 변수 (Vercel Project Settings → Environment Variables)
| 변수명 | 용도 | 비고 |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/settle-results`가 RLS를 우회해 모든 사용자 예측을 업데이트하는 데 사용 | Supabase 대시보드 → Project Settings → API 에서 확인. 절대 프론트엔드에 노출하지 않음 |
| `CRON_SECRET` | `/api/settle-results`가 Vercel Cron이 보낸 요청인지 검증하는 데 사용 | 임의의 랜덤 문자열. 설정해두면 Vercel이 Cron 호출 시 `Authorization: Bearer <값>` 헤더를 자동으로 붙여줌 |

## 실시간 주가 연동 방식

- **데이터 소스**: 네이버 증권 (polling.finance.naver.com)
- **인증**: 불필요 (공개 API)
- **CORS 해결**: Vercel Serverless Function 프록시
- **호출 흐름**: 브라우저 → /api/prices → 네이버 증권 API

## 장 마감 결과 자동 채점

- **트리거**: Vercel Cron, 매일 UTC 07:30 (KST 16:30) 1회 — Hobby 플랜의 "하루 1회" 제약에 맞춘 스케줄
- **대상**: `trade_date`가 오늘이고 `actual_close_price`가 비어 있는 예측 전체
- **판정 로직**:
  - 타자(방향 예측): 실제 종가가 `base_close_price` 대비 +1% 이상이면 up, -1% 이하면 down, 그 사이는 flat으로 판정 후 `bat_choice`와 비교해 `is_hit` 기록
  - 투수(가격 예측): `|pitcher_price - 실제종가| / 실제종가 × 100`(%)을 `era_value`로 기록 (낮을수록 정확)
- 주말 등 오늘자 예측이 없으면 아무 작업 없이 정상 종료 (에러 아님)

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
