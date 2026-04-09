# Sample 006 — BMW 5시리즈 G30 530i xDrive M 스포츠 플러스 (개인매물 · 첫 비딜러 샘플)

**Captured**: 2026-04-09
**Verdict**: `NEVER` (R08 killer + R10 누적 대형 수리)
**Significance**: 🆕 **첫 개인(비딜러) 매물 샘플**. 딜러 매물 대비 `contact.userType`, `partnership`, `detailFlags.isDealer`, `inspect/accident/profile/diagnosis` 페이로드, 성능점검 API 응답이 어떻게 달라지는지 처음 관찰.

## URL
- Main: https://fem.encar.com/cars/detail/41707401
- History: https://car.encar.com/history?carId=41707401
- Inspection API: https://api.encar.com/v1/readside/inspection/vehicle/41707401 → **404 Empty**

## Basic Info
| Field | Value |
|---|---|
| vehicleId | 41707401 |
| vin | **null** (개인매물은 base.vin 미공개?) |
| 차량번호 | 20소5501 |
| 제조사/모델 | BMW / 5시리즈 (G30) |
| 등급 | 530i xDrive M 스포츠 플러스 |
| 연식 | 2017/06 (2017년형, 9년차) |
| 주행거리 | 105,000km |
| 가격 / 신차가 | **2,250만원 / 7,480만원** (30.1%) |
| `domestic` | false |
| `importType` | **`NONE_IMPORT_TYPE`** (🆕 신값 — 005 는 `REGULAR_IMPORT`) |
| `spec.tradeType` | **`null`** (딜러 샘플의 `'D'` 가 아님 — `'I'` 도 아님) |
| `contact.userType` | **`CLIENT`** ⭐ (딜러: `DEALER`) |
| `contact.userId` | `ysb79` (개인 ID, `*` 가린 표시명: 용\*봉) |
| `contact.no` | `05062245180` (050 안심번호 동일 사용) |
| `contact.address` | 대구 남구 |
| `contact.contactType` | `MOBILE` |
| `contact.isVerifyOwner` | **`true`** ("소유주 인증 차량입니다" 배지) |
| `contact.isOwnerPartner` | **`false`** |
| `partnership.isPartneredVehicle` | **`false`** |
| `partnership.dealer` | `null` |
| `partnership.brand` | `null` |
| `partnership.certifiedBrand` | `null` |
| `detailFlags.isDealer` | **`false`** ⭐ |
| `detailFlags.isInsuranceExist` | true |
| `detailFlags.isHistoryView` | true |
| `detailFlags.isDiagnosisExist` | **false** |
| `advertisement.preVerified` | false |
| `advertisement.diagnosisCar` | false |
| `advertisement.trust` | `[]` |
| `advertisement.advertisementType` | `NORMAL` |
| `view.encarDiagnosis` | **`-1`** (미진단) |
| `view.encarMeetGo` | `-1` |
| 등록/최초광고 | 2026-03-21 / 2026-03-21 |
| 조회수 / 찜 | 364 / 7 |

## 🧮 룰 판정

| 룰 | 상태 | 근거 |
|---|---|---|
| R01 보험이력 공개 | ✅ PASS | `isInsuranceExist=true`, 보험 4건 노출 |
| R02 성능점검 공개 | ⚪ N/A | `isHistoryView=true` 이지만 인스펙션 API 404 → 점검표 자체 부재 가능성 |
| R03 엔카진단 | ❌ FAIL | `diagnosisCar=false`, `preVerified=false`, `view.encarDiagnosis=-1`, `trust=[]` |
| R04 프레임 무사고 | ⚪ N/A | 진단/점검표 모두 부재 — 판정 불가, `parse_failed{reason:'no_inspection'}` |
| R05 렌트/택시 | ✅ PASS | `driveCaution.rent=false`, `commercial=false`, `public=false` |
| R06 전손/침수/도난 | ✅ PASS | `driveCaution.theft=false`, 침수 플래그 없음 |
| R07 1인 신조 | ❌ FAIL | 17년 신차 출고 = **법인 명의**, 이후 매매업자 거래이전 2회 + 당사자 거래이전 1회 |
| **R08 자차보험 공백** | ❌ **KILLER** | `caution.no_insurance="있음"`, 미가입 2건: 20-11~20-12, 24-12 |
| R09 수리비 미확정 | ✅ PASS | 모든 보험건 부품/공임/도장 가격 명시 |
| **R10 자잘한 사고** | ❌ **WARN (대형)** | 4건 누적 약 **1,674만원**, 23-08 단일 건 599만원 부품비 (외제차 기준 초과) |
| R11 가격 적정성 | ✅ PASS | 신차대비 30.1% — 9년차 외제차 정상 |
| 🆕 R12 리콜 | ⚠️ WARN | 19-07 리콜 1건 (제원표 오기 — 안전 무관) |
| 🆕 R13 노후/고주행 | ⚠️ WARN | 9년차 / **105,000km** — 외제차 임계 근접 |

## 🆕 이 샘플의 핵심 기여

### 1. 개인매물 식별 필드 매트릭스

| 필드 | 딜러 매물 (001~005) | **개인 매물 (006)** |
|---|---|---|
| `contact.userType` | `DEALER` | **`CLIENT`** |
| `contact.userId` | 딜러 코드 | 개인 회원ID (`ysb79`) |
| `contact.isVerifyOwner` | (대개) false | **`true`** (소유주 본인 인증) |
| `contact.isOwnerPartner` | true (파트너 딜러) | **`false`** |
| `detailFlags.isDealer` | true | **`false`** |
| `partnership.dealer` | 객체 | **`null`** |
| `partnership.isPartneredVehicle` | true/false | **`false`** |
| `partnership.brand`/`certifiedBrand` | 객체 또는 null | **`null`** |
| `base.spec.tradeType` | `'D'` (가설) | **`null`** ⚠️ |
| `base.vin` | 보통 채워짐 | **`null`** |

⭐ **결정적 판정 룰**: `contact.userType === 'CLIENT' && detailFlags.isDealer === false` → 개인매물.
보조: `partnership.dealer === null && contact.isVerifyOwner === true`.

> ⚠️ `tradeType` 은 **개인매물에서 그냥 `null`**. 닥신이 "개인 vs 딜러"를 판정할 때 `tradeType` 에 의존하면 안 되고 `userType` + `isDealer` 로 판정해야 한다.

### 2. `inspect` / `inspectSummary` / `accident` / `profile` / `explain` = 빈 객체 `{}`

```js
window.__PRELOADED_STATE__.cars = {
  diagnosis: { items: [] },   // 진단 아이템 0
  inspect: {},                 // 빈 객체
  inspectSummary: {},          // 빈 객체
  accident: {},                // 빈 객체
  profile: {},                 // 빈 객체
  explain: {},                 // 빈 객체
  ...
}
```

딜러 매물에서는 `accident`, `inspect` 에 사고/점검 데이터가 풍부하게 들어 있었는데, **개인매물(미진단)** 은 모두 **빈 객체로 초기화** 된다 (필드 자체는 존재 → undefined-safe).

**파서 영향**: `cars.accident` 가 truthy 라고 해서 데이터가 있다고 가정하면 안 된다. `Object.keys(cars.accident).length > 0` 으로 가드.

### 3. `condition.inspection.formats === []` (빈 배열)

딜러 매물의 동일 필드는 `[{ type: 'X', ... }]` 형태였음. 개인매물은 빈 배열.

### 4. ⭐ 성능점검 API 가 **404 Empty** 를 반환

```
GET https://api.encar.com/v1/readside/inspection/vehicle/41707401
→ 404 Not Found, body: ""
```

샘플 005 에서 우리가 청사진을 그렸던 `master.detail.{accdient, waterlog, recall, …}` 풀스키마는 **이 매물에 존재하지 않는다**. 즉:
- 외부 직호출 → 404
- `__PRELOADED_STATE__.cars.inspect` → `{}`
- 페이지 DOM에도 진단 섹션 없음

**파서 영향**: 인스펙션 가로채기(fetch monkey-patch) 로직은 404 응답도 우아하게 처리해야 한다 (`{ status: 'no_inspection', reason: 'individual_seller_no_diagnosis' }`).

```typescript
// inspect-fetch-interceptor.ts
if (res.status === 404 && /\/v1\/readside\/inspection\/vehicle\/\d+$/.test(url)) {
  postMessage({ type: 'ENCAR_INSPECTION_MISSING', carId, reason: 'no_inspection_record' });
}
```

R02/R04 룰은 자동으로 N/A 로 떨어진다. 결과적으로 **개인매물의 닥신 verdict 는 거의 항상 R03 FAIL + R04 N/A 가 디폴트**.

### 5. `release` 가 **거의 전부 "정보없음"**

```json
{
  "date": "정보없음",
  "nation": "정보없음",
  "use": "정보없음",
  "fixedPrice": "7,480만원",   // 이 한 줄만 의미 있음
  "storePrice": "정보없음",
  "fuel": "정보없음",
  "cityConsumption": "정보없음",
  "expresswayConsumption": "정보없음"
}
```

005 에서는 `release.date / nation / use / fuel / 연비` 가 풀로 채워졌었는데, 본 샘플은 거의 다 비어 있다. 이는 **연식/매물 데이터 출처 차이** (구형 데이터셋) 로 추정. **파서는 `release.*` 필드 전체를 optional 처리**해야 하고 `"정보없음"` 문자열을 명시적으로 null 로 정규화해야 한다.

```typescript
const norm = (v?: string) => (v == null || v === '정보없음' ? null : v);
```

### 6. 첫 출고 = **법인 명의** 케이스 (timeline[0])

```json
{
  "title": "신차 출고(법인 명의)",
  "layerData": {
    "flag": "CORPORATION",
    "content": [
      { "name": "최초 구매자", "value": "주식회사" },
      { "name": "신차 정가", "value": "7,480만원" },
      ...
    ]
  }
}
```

`enlogData.detail` 에도 `new_release_corporate` 가 등장 (005 는 `new_release_personal`). **R07(1인 신조) 판정 시 `flag === 'CORPORATION'` 또는 `enlogData.detail` 에 `new_release_corporate` 가 있으면 즉시 FAIL**.

**카탈로그 확장**:
- `flag` 값: `CORPORATION` | `PERSONAL` | `DEALER` | `DIRECT` | `USE_MY_INSURANCE` | `USE_OTHER_INSURANCE` | `PROPERTY_DAMAGE` | `리콜완료`
- `enlogData.detail` 토큰: `new_release_corporate`, `new_release_personal`, `change_registration`, `change_owners`, `damage_mycar`, `damage_othercar`, `recall`, `noinsured`, `car_inspection`, `repair_history`

### 7. `driveContents` 가 **거의 전부 `company: true`**

```json
[
  { "period": "정보없음 ~ 20년 11월", "user": null, "company": true,  "mileage": "25,338km" },
  { "period": "20년 11월 ~ 20년 12월", "user": null, "company": true,  "mileage": "0km" },
  { "period": "20년 12월 ~ 24년 12월", "user": null, "company": true,  "mileage": "66,701km" },
  { "period": "24년 12월 ~",          "user": "",   "company": false, "mileage": "운행중" }
]
```

특이점: **17~20년 첫 4년이 통째로 `정보없음 ~ 20년 11월` 한 줄**로 묶임 (법인 출고 후 4년 운행 데이터 누락). 이는 driveContents 가 **정부 등록정보 기반** 이라 법인 명의 기간은 상세 분리가 안 되는 듯.

**R07 강화 규칙**:
- `company:true` 행을 모두 제외하면 본 샘플은 실소유자 1명만 남음 → 표면상 "1인 운행"
- 그러나 timeline 의 `소유자변경` 이벤트(`flag: DEALER`, `flag: DIRECT`)를 카운트하면 3회 이전
- **driveContents 만으로 R07 판정 불가능 — timeline 의 변경 이벤트와 cross-check 필수**

### 8. `userType: "CLIENT"` 의 의미

엔카는 일반 회원을 `CLIENT`, 딜러 회원을 `DEALER` 로 분류. `PERSONAL`/`INDIVIDUAL` 같은 값은 **존재하지 않음**. 우리가 추측했던 enum 후보는 모두 빗나갔다.

**TypeScript 타입 확정**:
```typescript
type EncarUserType = 'CLIENT' | 'DEALER';   // 관측 기반, 추가 발견 시 union 확장
```

### 9. 본문 텍스트 (`oneLineText: null` 이지만 본문은 풍부)

`base.advertisement.oneLineText` 는 `null` 이지만 페이지 텍스트에는 판매자가 직접 쓴 정비 이력이 포함:
```
사고는 제가 가져오기전 트렁크,뒷문짝 으로 알고있습니다
25년2월 헤드 작업 280만원(사진첨부)
25년3월 미미(엔진,미션) 작업60만원
25년4월 고질병 냉각수누유(오일필터하우징)65만
25년8월 라지에이터+호수류 85만원
```

이 판매자 자기신고 정보는 **보험이력에 잡히지 않은 정비** (보험 미처리 자비 수리). `cars.explain` 또는 `cars.sellingpoint` 같은 다른 키에 들어있을 가능성. 본 수집에서는 `explain: {}` 로 빈 객체였으나 React가 lazy-load 하는지 확인 필요. **R10 을 강화하려면 본문 텍스트 LLM 추출 또는 정규식 파싱이 추가 정보원으로 가치 있음**.

### 10. 보험이력 4건 + 자차 미가입 2건 종합

| 날짜 | 종류 | 부품 | 공임 | 도장 | 합계 |
|---|---|---|---|---|---|
| 18-05 | 내차피해 | 140 | 36 | 57 | **234만** |
| 18-05 | 타차가해 | 3 | 15 | 18 | 37만 |
| 18-06 | 내차피해 | 323 | 41 | 57 | **422만** |
| 18-06 | 타차가해 | 26 | 7 | 15 | 49만 |
| 22-04 | 내차피해 | 110 | 31 | 41 | **183만** |
| 23-08 | 내차피해 | 599 | 75 | 160 | **835만** ⭐ |

내차피해 누적 1,674만원 / 가격 2,250만원 = **74.4%**. 이 단일 통계만으로 R10 NEVER 후보.

자차보험 미가입:
1. 20-11 ~ 20-12 (1개월) — 매매업자 거래 시점
2. 24-12 ~ 24-12 (0개월) — 당사자 거래 시점

**관찰**: 자차보험 공백은 **소유자변경 시점에 발생**하는 패턴. 즉 `R08` 은 종종 `R07` 과 동반된다. 닥신 UI 가 두 룰을 함께 강조할 가치 있음.

### 11. `summary` 가 또다시 오인 위험

```
"용도 변경 이력이 없는 차량이네요!"
```

005 와 동일하게 `enlogData.text === "no_change"` 로 인해 긍정 메시지가 표시되지만, 실제로는 자차 미가입 + 누적 1,674만 수리 + 9년 105k km 외제차. 닥신은 **`summary` 를 절대 판정 근거로 쓰지 말 것** (재확인).

## Raw 요약 (저장용)

```json
{
  "carId": 41707401,
  "sellerType": "individual",
  "userType": "CLIENT",
  "isDealer": false,
  "isVerifyOwner": true,
  "priceRatio": 0.301,
  "detailFlags": { "isInsuranceExist": true, "isHistoryView": true, "isDiagnosisExist": false },
  "inspectApi": { "status": 404, "body": "" },
  "preloadedInspect": "{}",
  "preloadedAccident": "{}",
  "diagnosisItems": 0,
  "release": { "fixedPrice": "7,480만원", "_others": "정보없음" },
  "driveCaution": { "rent": false, "commercial": false, "public": false, "theft": false, "owner": false },
  "caution": { "no_insurance": "있음" },
  "noInsurancePeriods": 2,
  "enlogData": {
    "detail": "new_release_corporate,change_registration,damage_mycar,damage_othercar,recall,noinsured,change_owners,car_inspection",
    "text": "no_change"
  },
  "firstReleaseFlag": "CORPORATION",
  "ownerChangeEvents": 3,
  "insuranceClaimsMyCarTotal": 1674,
  "maxSinglePartPrice": 599,
  "verdict": "NEVER",
  "killerRules": ["R08"],
  "warnRules": ["R03", "R07", "R10", "R12", "R13"]
}
```

## 결론

**닥신 verdict: `NEVER`**

이유:
1. **R08 KILLER** — 자차보험 공백 2회 (소유자변경 시점에 발생)
2. **R10 심각** — 내차피해 누적 1,674만원 (매가의 74%), 단일 부품비 599만원
3. **R03 FAIL** — 엔카진단 없음 (외제차 9년차 신뢰성 검증 불가)
4. **R07 FAIL** — 법인 출고 + 매매업자 2회 + 당사자 1회 거래
5. **R13 WARN** — 9년차 105k km 외제차

**개인매물이라는 사실 자체는 NEVER 사유가 아니지만**, 본 케이스는 개인매물의 전형적 리스크(매물 출처 불투명, 진단 부재, 자기신고 정비)와 결합되어 종합적으로 위험. 닥신 UI 는 "개인매물 + 미진단" 조합에 대해 별도 경고 배지를 띄우는 것이 좋겠다.
