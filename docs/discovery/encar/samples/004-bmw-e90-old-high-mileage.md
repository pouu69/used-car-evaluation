# Sample 004 — BMW 3시리즈 E90 328i (외제차 + 노후 + 자차보험 공백)

**Captured**: 2026-04-07
**Verdict**: `NEVER` (R08 killer) + multiple WARNs
**Significance**: 🔥 First imported car + first `driveCaution.rent=false` case + DOM diagnosis detail parse success

## URL
- Main: https://fem.encar.com/cars/detail/41529631
- History: https://car.encar.com/history?carId=41529631

## Basic Info
| Field | Value |
|---|---|
| vehicleId | 41529631 |
| vin | WBAVA31057KM60091 |
| 차량번호 | 34루6142 |
| 제조사/모델 | BMW 3시리즈 (E90) / 328i 세단 |
| 연식 | 2007/12 (19년차) ⚠️ |
| 주행거리 | **213,892km** ⚠️⚠️ |
| 가격 / 신차가 | 290만원 / 6,390만원 |
| `domestic` | **false** ← 외제차 NEW |
| `importType` | `REGULAR_IMPORT` |
| preVerified | false |
| diagnosisCar | true |
| trust | `["Warranty"]` |
| 딜러 | 이상욱 / 유미카 (경기 김포) |
| 조회수 | 1,310 (very high) |

## 🧮 룰 판정

| 룰 | 상태 | 근거 |
|---|---|---|
| R01 보험이력 공개 | ✅ PASS | |
| R02 성능점검 공개 | ✅ PASS | |
| R03 엔카진단 | ✅ PASS | isDiagnosisExist=true |
| R04 프레임 무사고 | ✅ PASS | DOM "프레임무사고 확인" + "프레임 진단정상" |
| R05 렌트/택시 | ✅ **PASS** | driveCaution.rent=**false** (법인이어도 rent 아님) |
| R06 전손/침수/도난 | ✅ PASS | |
| R07 1인 신조 | ❌ FAIL | 여러 번 이전 (법인↔개인) |
| **R08 자차보험 공백** | ❌ **KILLER** | caution.no_insurance="있음" |
| R09 수리비 미확정 | ⏳ TODO (48건 스캔) | |
| R10 자잘한 사고 | ⚠️ WARN | 14 insurance date, 외제차 200만 기준 검증 필요 |
| R11 가격 적정성 | ⚪ N/A | 19년차 `-%` |
| 🆕 R12 리콜 | ⚠️ WARN | 2건 |

## 🆕 이 샘플의 핵심 기여

### 1. DOM 진단 디테일 완전 추출 성공 (AI-free)

엔카진단 있는 매물은 DOM에 이런 패턴이 노출됨:
```
프레임무사고 확인
프레임 진단정상
외부패널 진단교환
교환1
판금없음
부식없음
내차 피해총 8,977,290원 (9회)
타차 가해총 2,332,154원 (6회)
특이 사항없음
```

파서 정규식:
```typescript
const DIAG_RX = {
  frameNoAccident: /^프레임무사고 확인$/,
  frameDiag: /^프레임 진단(정상|수리|교환)$/,
  panelDiag: /^외부패널 진단(정상|교환|판금)$/,
  exchange: /^교환\s*(\d+)$/,
  paneling: /^판금\s*(없음|\d+)$/,
  rust: /^부식\s*(없음|있음)$/,
  ownDamageTotal: /^내차\s*피해총\s*([\d,]+)원\s*\((\d+)회\)$/,
  otherDamageTotal: /^타차\s*가해총\s*([\d,]+)원\s*\((\d+)회\)$/,
  specialNote: /^특이\s*사항\s*(없음|있음)$/,
};
```

### 2. `driveCaution.rent` 의미 재정의

**이전 가정**: "법인 명의 신차출고 = 렌터카"
**반증**: 이 BMW는 법인 명의지만 `rent: false`

**결론**: **`driveCaution.rent` 플래그를 직접 사용**. 법인 여부는 보조 정보일 뿐 렌트 판정에 직접 쓰면 안 됨.

### 3. `uiData.item.caution.recall` — 리콜 수 필드 (optional)
- 이전 샘플에는 없었음
- 값: 문자열 `"2건"` 등

### 4. `uiData.summary` 긍정 케이스
- Sample 001~003: 부정 경고
- Sample 004: **"용도 변경 이력이 없는 차량이네요!"** ← 긍정

### 5. `enlogData.text` 새 값: `"no_change"`

### 6. `release.storePrice: "정보없음"` — 오래된 차는 누락 가능

### 7. 외제차 스키마
```typescript
category: {
  domestic: false,
  importType: 'REGULAR_IMPORT' | 'BRAND_IMPORT' | ...,  // 값 카탈로그 필요
}
```

### 8. 노후/고주행 매물 별도 룰 필요?

가이드: "10년 이상 매물은 별로", "연식보단 키로수"
- 19년차 + 21만km → 별도 경고 룰 고려?

**제안 R13**: `연식 > 10년` OR `주행 > 200,000km` → WARN (killer 아님)
