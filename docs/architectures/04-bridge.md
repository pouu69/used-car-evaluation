# 브릿지 계층

> `src/core/bridge/encar-to-facts.ts`

`encarToFacts(parsed: EncarParsedData): ChecklistFacts` — 사이트 종속 `EncarParsedData`를 사이트 무관 `ChecklistFacts`로 변환한다.

---

## 딜러 vs 개인 매물 분기 (핵심 불변식)

### 판별 로직

`isPersonalListing()` — 다음 중 하나라도 충족하면 개인 매물:
- `detailFlags.isDealer === false`
- `contact.userType === 'CLIENT'`

### 개인 매물일 때 처리

| 규칙 | 처리 | 이유 |
|------|------|------|
| R03 | `failed('not_applicable_personal')` | 개인 매물은 엔카진단 구매 불가 |
| R04 | `unknown` (프레임 신호 없을 때) | 진단 없는 개인 매물에 부당 감점 방지 |

`bridgeWarnings`에 `'personal_listing'`, `'r03_skipped_personal'` 추가.

---

## 프레임 손상 (R04) — 다중 소스 계층 해소

3개 소스를 우선순위 순서로 탐색한다:

| 순위 | 소스 | 권위 | bridgeWarning |
|------|------|------|---------------|
| 1 | `diagnosisApi` → `getFrameIntact()` | 엔카 유료 진단 (최고) | — |
| 2 | `inspectionApi` → `getFrameFromInspection()` | 정부 성능점검 | `frameDamage_from_inspection` 또는 `frameDamage_from_inspection_simpleRepair` |
| 3 | 리본 폴백 | `isDiagnosisExist === true`이면 프레임 무사고 추론 | `frameDamage_from_ribbon` |

> 엔카는 프레임 손상 차량에 진단 배지를 부여하지 않으므로, 리본 존재 = 프레임 무사고로 추론할 수 있다.

---

## 필드 매핑 상세

### R01 — 보험이력 공개

```
detailFlags.isInsuranceExist → insuranceHistoryDisclosed
```

### R02 — 성능점검 공개

```
detailFlags.isHistoryView → inspectionReportDisclosed
```

### R03 — 엔카진단

```
detailFlags.isDiagnosisExist → hasEncarDiagnosis
개인 매물이면 → failed('not_applicable_personal')
```

### R04 — 프레임 무사고

위의 다중 소스 계층 해소 참조.

### R05 — 용도 이력

RecordApi 필드와 ChecklistFacts 필드의 매핑:

| RecordApi | ChecklistFacts | 의미 |
|-----------|---------------|------|
| `loan` | `rental` | 렌트 |
| `business` | `taxi` | 택시 |
| `government` | `business` | 관용 |

> 주의: API 필드명과 팩트 필드명이 직관적이지 않다. `government`(관용)가 `business`로, `business`(택시)가 `taxi`로 매핑된다.

### R06 — 전손/침수/도난

```
recordApi.totalLossCnt    → totalLossHistory.totalLoss
recordApi.floodTotalLossCnt → totalLossHistory.floodTotal
recordApi.floodPartLossCnt  → totalLossHistory.floodPart
recordApi.robberCnt       → totalLossHistory.robber
```

### R07 — 소유자 변경

```
recordApi.ownerChangeCnt → ownerChangeCount
```

### R08 — 보험 공백

```
getInsuranceGapPeriods(recordApi)
  → YYYYMM~YYYYMM 문자열 파싱
  → monthsBetweenInclusive() 로 공백 개월 수 계산
  → { hasGap, totalMonths, periods[] }
```

### R09 — 수리비 미확정

```
현재 hardcoded → value(false) (항상 pass)
```

### R10 — 보험처리 규모

```
recordApi.myAccidentCost    → minorAccidents.ownDamageWon
recordApi.otherAccidentCost → minorAccidents.otherDamageWon
base.category.domestic      → minorAccidents.domestic
```

### R11 — 가격 적정성

```
base.advertisement.price × 10000 → priceVsMarket.priceWon
base.category.newPrice × 10000   → priceVsMarket.newPriceWon
priceWon / newPriceWon            → priceVsMarket.ratio
```
