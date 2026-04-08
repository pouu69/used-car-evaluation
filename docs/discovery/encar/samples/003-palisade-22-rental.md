# Sample 003 — 팰리세이드 2.2 2WD 캘리그래피 (렌터카 + 타차가해)

**Captured**: 2026-04-07
**Verdict**: `NEVER` (R03, R05, R08 + R10 warning)

## URL
- Main: https://fem.encar.com/cars/detail/41762441
- History: https://car.encar.com/history?carId=41762441

## Basic Info
- vehicleId: 41762441
- 차량번호: 344구3445
- 제조사/모델: 현대 팰리세이드 / 디젤 2.2 2WD 캘리그래피
- 연식: 2022/01
- 주행거리: 74,816km
- 가격: 3,350만원 (신차가 4,774만원, 신차대비 70%)
- 딜러: 김용일 / (주)타워모터스 (인천 서구)
- tradeType: "D" (Dealer)

## 평가 결과

| 룰 | 상태 | 근거 |
|---|---|---|
| R01 보험이력 공개 | ✅ PASS | isInsuranceExist=true |
| R02 성능점검 공개 | ✅ PASS | isHistoryView=true |
| **R03 엔카진단** | ❌ **KILLER** | isDiagnosisExist=false |
| R04 프레임 무사고 | ⚪ UNKNOWN | 진단 섹션 DOM 부재 |
| **R05 렌트/택시** | ❌ **KILLER** | driveCaution.rent=true |
| R06 전손/침수/도난 | ✅ PASS | |
| R07 1인 신조 | ⚪ UNKNOWN | 법인 |
| **R08 자차보험 공백** | ❌ **KILLER** | caution.no_insurance="있음" |
| R09 수리비 미확정 | ✅ PASS | |
| **R10 자잘한 사고** | ⚠️ **WARN** | 타차가해 257만원 > 100만원 |
| R11 가격 적정성 | ✅ PASS | 70% |

## 신규 스키마 발견

- 보험 타입 추가: `"보험처리 (타차가해)"` (Sample 002은 "내차피해")
- 타임라인 이벤트 `변경등록` (NEW)
- `spec.tradeType: "D"` (Dealer) 필드
- 신차대비 임계값: 257만원 내차가해가 국산 100만원 기준 초과 → R10 WARN
