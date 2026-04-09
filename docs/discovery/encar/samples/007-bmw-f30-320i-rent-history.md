# Sample 007 — BMW 3시리즈 F30 320i M 스포츠 (렌트이력 + 5회 이전 + 자차공백 2회)

**Captured**: 2026-04-09
**Verdict**: `NEVER` (R05 KILLER + R08 KILLER + R07 FAIL + R10 WARN)
**Significance**: 🆕 **첫 "렌트(rent) 이력 양성" 샘플** — `driveCaution.rent === true`, `caution.rent === "있음"`, `enlogData.text === "use_rent"` 3개 필드가 동시에 활성화되는 케이스를 처음 관찰. 동시에 record API 의 `loan: 1` (저당 흔적) 도 처음 등장. 5회 소유자 변경 + 4건의 보험 사고 + 자차 미가입 2회로 R05/R07/R08/R10 이 한꺼번에 트리거되는 "최악 조합" 샘플.

## URL
- Main: https://fem.encar.com/cars/detail/41769443
- History: https://car.encar.com/history?carId=41769443
- Record API: https://api.encar.com/v1/readside/record/vehicle/41769443/open?vehicleNo=174%EB%AC%B41429 → **200 OK**
- Diagnosis API: https://api.encar.com/v1/readside/diagnosis/vehicle/41769443 → **HTTP 404** (미진단)
- Inspection API: https://api.encar.com/v1/readside/inspection/vehicle/41769443 → **200 OK** (성능점검 존재)

## Basic Info
| Field | Value |
|---|---|
| vehicleId | 41769443 |
| vin | **`WBA8A9108JAE91643`** (딜러 매물이라 채워짐 — 006 개인매물의 `null` 과 대조) |
| 차량번호 | 174무1429 |
| 제조사/모델 | BMW / 3시리즈 (F30) |
| 등급 | 320i M 스포츠 |
| 연식 | 2018/03 (2018년형, 8년차) |
| 주행거리 | 81,922km (인스펙션 기준 81,906km) |
| 가격 / 신차가 | **1,699만원 / 4,970만원** (34.2%) |
| `domestic` | false |
| `importType` | `NONE_IMPORT_TYPE` (006 과 동일) |
| `spec.tradeType` | **`'D'`** (딜러 가설 재확인) |
| `contact.userType` | **`DEALER`** |
| `contact.userId` | `nephilim0501` |
| `contact.no` | `05062163205` |
| `contact.address` | 경기 수원시 권선구 권선로 308 |
| `contact.isVerifyOwner` | false |
| `contact.isOwnerPartner` | **`true`** |
| `partnership.isPartneredVehicle` | **`true`** |
| `partnership.dealer` | `{ name: "박용성", firm: { code: "4441", name: "무결점카모터스" } }` |
| `partnership.brand` / `certifiedBrand` | null / null |
| `detailFlags.isDealer` | **`true`** |
| `detailFlags.isInsuranceExist` | true |
| `detailFlags.isHistoryView` | true |
| `detailFlags.isDiagnosisExist` | **false** |
| `advertisement.preVerified` | false |
| `advertisement.diagnosisCar` | false |
| `advertisement.trust` | `[]` |
| `advertisement.advertisementType` | `NORMAL` |
| `advertisement.oneLineText` | **"엔카 실촬영"** |
| `view.encarDiagnosis` | `-1` (미진단) |
| `view.encarMeetGo` | `-1` |
| 등록 / 최초광고 | 2026-03-31 / 2026-03-31 |
| 조회수 / 찜 | 178 / 3 |

## 🧮 11 룰 판정

| 룰 | 상태 | 근거 |
|---|---|---|
| R01 보험이력 공개 | ✅ PASS | `isInsuranceExist=true`, history `insurance` 4건 노출 |
| R02 성능점검 공개 | ✅ PASS | inspection API 200, `condition.inspection.formats=["TABLE"]` |
| R03 엔카진단 | ❌ FAIL | `diagnosisCar=false`, `preVerified=false`, `view.encarDiagnosis=-1`, `trust=[]`, diagnosis API 404 |
| R04 프레임 무사고 | ✅ PASS | inspection `master.accdient === false`, `master.simpleRepair === true` (단순 수리만), `outers=3`/`inners=8` |
| **R05 렌트/택시** | ❌ **KILLER** | `driveCaution.rent === true`, `caution.rent === "있음"`, `enlogData.text === "use_rent"`, summary 메시지: `"렌트이력이 있는 차량입니다. 구매 전 참고하세요!"`, `release.use === "(비,대여)사업용"`, record API `loan: 1` (저당) |
| R06 전손/침수/도난 | ✅ PASS | record API `totalLossCnt=0, floodTotalLossCnt=0, robberCnt=0` |
| R07 1인 신조 | ❌ FAIL | `enlogData.detail` 에 `new_release_corporate` (법인 출고) — record API `ownerChangeCnt: 5` (관측 최대치) |
| **R08 자차보험 공백** | ❌ **KILLER** | `caution.no_insurance === "있음"`, record API `notJoinDate1="202108~202109"`, `notJoinDate2="202409~202502"` (총 6개월 공백) |
| R09 수리비 미확정 | ⚠️ WARN | history `insurance[1]` 의 `partPrice="-"` (부품비 미기재 — 새 패턴), `accidents[4]` 는 `partCost: 1` (1원 — 사실상 미기재) |
| **R10 자잘한 사고** | ❌ **WARN (대형)** | record API: `myAccidentCost=2,141,500`, `otherAccidentCost=16,054,570`, `myAccidentCnt=2`, `otherAccidentCnt=3`. 단일 25-02-23 1건 부품비 376만 + 공임 238만 + 도장 164만 = **778만원**, 보험금 984만원 |
| R11 가격 적정성 | ✅ PASS | 1,699 / 4,970 = 34.2%, 8년차 외제차 정상 |

## 🆕 이 샘플의 핵심 기여

### 1. ⭐ 첫 "렌트(rent) 이력 양성" 케이스 — R05 트리거 필드 매트릭스

001~006 까지는 모두 `driveCaution.rent === false` 였다. 본 샘플이 처음으로 양성:

| 신호 위치 | 값 | 설명 |
|---|---|---|
| `uiData.summary` | `"렌트이력이 있는 차량입니다. 구매 전 참고하세요!"` | UI 가 직접 경고 출력 |
| `uiData.item.drive.caution.rent` | **`true`** | 가장 정확한 boolean 신호 |
| `uiData.item.caution.rent` | `"있음"` | 한국어 enum, "없음"/"있음" |
| `uiData.enlogData.text` | **`"use_rent"`** | 005/006 의 `"no_change"` 와 대비되는 새 토큰 |
| `uiData.item.release.use` | `"(비,대여)사업용"` | 신차 출고 시점 용도 — 법인 렌트카로 출고됨 |
| record API `loan` | **`1`** | 🆕 첫 관측 — 저당(리스/렌트 잔존가) 흔적 가능성 |

⭐ **닥신 R05 판정 우선순위**: `driveCaution.rent` (가장 안정적) → `caution.rent==="있음"` → `enlogData.text==="use_rent"` → `release.use` 정규식. 4개 중 2개 이상이 양성이면 R05 KILLER.

> ⚠️ `release.use` 의 `"(비,대여)사업용"` 은 005/006 의 `"정보없음"` 또는 `"자가용"` 과 다른 새 enum. 추가 관측 필요.

### 2. 🆕 record API `loan: 1` — 첫 저당 양성

001~006 모두 `loan: 0` 이었다. 본 샘플은 `loan: 1`. 렌트카 출신답게 리스/렌트 잔존가 또는 운영사 저당이 잔존했을 가능성. record API 스키마상 `loan` 은 boolean-like int (0/1) 으로 추정.

**파서 영향**: `record.loan === 1` 은 R05 의 보조 신호로 가산. 단독으로는 KILLER 아님(이미 매각 시점에 해소됐을 수 있음) — WARN 으로 표시.

### 3. ownerChangeCnt: 5 — 관측 최대치 (002 2회, 005 3회, 006 3회 대비)

```
record API: ownerChangeCnt: 5
driveContents: 6개 행 (위치/회사 변경 6회)
timeline: 13 events
```

driveContents 가 **법인 → 개인 → 개인 → 법인 → 개인 → 개인** 패턴. 즉 차량이 운행 중간에 다시 법인(렌트사 또는 매매상사) 으로 회귀했다 재판매됐음. **R07 강화 규칙**: `ownerChangeCnt >= 4` 면 즉시 FAIL, `>=5` 면 NEVER 후보로 가산.

### 4. 🆕 자차보험 공백 패턴 — 6개월 (단일 공백 최대치)

```
notJoinDate1: 202108~202109 (1개월) — 21년 8월 첫 매매 시점
notJoinDate2: 202409~202502 (5개월) — 24년 9월~25년 2월 ⭐
```

006 의 공백은 1개월짜리 2건이었음. 본 샘플 `notJoinDate2` 는 **5개월 단일 공백** — 그 기간에 차량이 어디서 어떤 운행을 했는지 추적 불가능. 그리고 **공백 종료 직후 25-02-23 단일 날짜에 타차가해 3건이 동시 발생** (보험금 합계 약 2,030만원). 즉 **공백 종료 직후 첫 보험 청구가 곧바로 대형 사고** = 운행 이력 누락 의심 강도 최대.

**닥신 UI 제안**: 자차 미가입 종료 후 첫 사고가 30일 이내에 발생하면 별도 경고 배지("공백 직후 사고 — 누락 운행 의심").

### 5. 🆕 history `partPrice: "-"` 미기재 패턴 (R09 새 케이스)

```json
{ "type": "insurance", "name": "보험처리 (내차피해)",
  "insurance": { "date": "2024년 08월 03일", "partPrice": "-", "laborPrice": "36만원", "paintingPrice": "36만원" }}
```

005 까지는 `partPrice` 에 항상 숫자가 들어있거나 `"0만원"` 이었다. 본 샘플은 처음으로 `"-"` 문자열 관측. record API 쪽 동일 사건은 `partCost: 1` (1원) 로 표현. **두 데이터 소스의 결측 표현이 다름** → 파서 정규화 필요:

```typescript
const normPartPrice = (raw?: string | number): number | null => {
  if (raw == null) return null;
  if (typeof raw === 'string' && (raw === '-' || raw === '정보없음')) return null;
  if (typeof raw === 'number' && raw <= 1) return null;  // record API 의 1 = 결측
  return typeof raw === 'string' ? parseInt(raw.replace(/[^0-9]/g, ''), 10) : raw;
};
```

R09 룰: 4건 중 1건이 결측 → WARN (FAIL 아님).

### 6. inspection API 200 + diagnosis API 404 동시 관측 (분리 가능성 확정)

| API | 결과 | 의미 |
|---|---|---|
| `/v1/readside/inspection/vehicle/{id}` | **200 OK** | 정부 의무 성능점검표 (공식 점검소) — 존재 |
| `/v1/readside/diagnosis/vehicle/{id}` | **HTTP 404** | 엔카진단(자체 프리미엄 진단) — 미실시 |

005/006 에서 두 API 모두 404 인 경우와 005 에서 두 API 모두 200 인 경우만 관측. **본 샘플이 처음으로 "inspection 200 + diagnosis 404" 분리 케이스를 확정** — 두 API 가 독립 서비스임이 입증됨. 결과적으로:
- R02 (성능점검 공개) → inspection API 만 본다 → **PASS**
- R03 (엔카진단) → diagnosis API + `diagnosisCar` 플래그를 본다 → **FAIL**
- R04 (프레임 무사고) → inspection API `master.accdient` 만 본다 → **PASS**

### 7. inspection `simpleRepair: true` — 첫 관측

005/006 까지 `master.simpleRepair` 필드의 true 케이스가 없었음. 본 샘플은 `accdient: false, simpleRepair: true` — 즉 **프레임은 멀쩡하지만 단순수리는 있음**. R04 룰에서:
- `accdient === true` → R04 FAIL (프레임 손상)
- `accdient === false && simpleRepair === true` → R04 PASS (외판/볼팅 교체만)
- `accdient === false && simpleRepair === false` → R04 PASS (완전 무사고)

### 8. 6개 driveContents 의 법인↔개인 핑퐁 패턴

```
18-01 ~ 21-08 [중구]      company:true   54,626km  ← 법인 렌트
21-08 ~ 21-09 [수원]      company:false  0km       ← 개인 (등록만)
21-09 ~ 24-09 [화성]      company:false  17,596km  ← 개인 운행
24-09 ~ 25-02 [강서]      company:true   0km       ← 법인 회귀 (매매상)
25-02 ~ 26-03 [춘천]      company:false  9,684km   ← 개인 운행
26-03 ~      [수원]       company:false  운행중    ← 매매상 등록
```

24-09 ~ 25-02 의 `company:true && mileage:"0km"` 는 차량이 매매상 재고로 잠자던 시기. 그리고 그 직후가 자차 미가입 5개월 + 25-02-23 동시 사고 3건. **매매상 보유 → 출고 직후 사고** 패턴.

### 9. 본 샘플의 4건 보험사건 누적 표

| 날짜 | type | 부품 | 공임 | 도장 | 보험금 | 비고 |
|---|---|---|---|---|---|---|
| 24-08-03 | 2 (내차피해) | "-" / 1원 | 36만 | 36만 | 100만 | partPrice 결측 |
| 25-02-23 | 3 (타차가해) | 106만 | 13만 | 25만 | 187만 | |
| 25-02-23 | 3 (타차가해) | 229만 | 277만 | 173만 | 858만 | 단일 최대 공임 |
| 25-02-23 | 3 (타차가해) | 376만 | 238만 | 164만 | **984만** | 단일 최대 보험금 |
| 25-05-09 | 1 (?) | 107만 | 8만 | 25만 | 124만 | |

⭐ `accidents[i].type` 의 enum: 005 까지 `1`/`2` 만 봤는데 본 샘플에서 `3` 첫 관측. 가설:
- `1` = 내차피해 (자차)
- `2` = 내차피해 (대물 타차)
- `3` = 타차가해

**otherAccidentCost 1,605만 + myAccidentCost 214만 = 1,819만 / 매가 1,699만 = 107%**. 즉 누적 사고 가액이 차값 자체를 넘는다. R10 NEVER 후보.

### 10. 「엔카 실촬영」 oneLineText — 새 광고 표시

001~006 의 `oneLineText` 는 모두 `null` 또는 자유 텍스트였음. 본 샘플은 `"엔카 실촬영"` — 엔카 플랫폼이 직접 부여하는 인증성 라벨로 추정. **R03 (엔카진단)** 과는 무관한 별도 카테고리 (사진 검증 정도). 닥신은 이 텍스트를 신뢰 신호로 절대 격상하지 말 것.

## Raw 요약 (저장용)

```json
{
  "carId": 41769443,
  "sellerType": "dealer",
  "userType": "DEALER",
  "isDealer": true,
  "vin": "WBA8A9108JAE91643",
  "vehicleNo": "174무1429",
  "model": "BMW F30 320i M Sport",
  "year": "2018/03",
  "mileage": 81922,
  "price": 1699,
  "originPrice": 4970,
  "priceRatio": 0.342,
  "detailFlags": { "isInsuranceExist": true, "isHistoryView": true, "isDiagnosisExist": false },
  "apis": {
    "record": "200 OK",
    "inspection": "200 OK",
    "diagnosis": "HTTP 404"
  },
  "inspection": { "accdient": false, "simpleRepair": true, "waterlog": false, "recall": false, "tuning": false, "supplyNum": "20261133667" },
  "driveCaution": { "rent": true, "commercial": false, "public": false, "theft": false, "owner": false },
  "caution": { "no_insurance": "있음", "rent": "있음" },
  "release": { "use": "(비,대여)사업용", "fixedPrice": "4,970만원", "nation": "독일", "fuel": "휘발유" },
  "enlogData": {
    "detail": "new_release_corporate,car_inspection,change_owners,noinsured,change_registration,damage_mycar,repair_history,damage_othercar",
    "text": "use_rent"
  },
  "record": {
    "loan": 1,
    "business": 0,
    "government": 0,
    "totalLossCnt": 0,
    "floodTotalLossCnt": 0,
    "robberCnt": 0,
    "ownerChangeCnt": 5,
    "myAccidentCnt": 2,
    "otherAccidentCnt": 3,
    "myAccidentCost": 2141500,
    "otherAccidentCost": 16054570,
    "notJoinDate1": "202108~202109",
    "notJoinDate2": "202409~202502"
  },
  "verdict": "NEVER",
  "killerRules": ["R05", "R08"],
  "failRules": ["R03", "R07"],
  "warnRules": ["R09", "R10"],
  "passRules": ["R01", "R02", "R04", "R06", "R11"]
}
```

## 결론

**닥신 verdict: `NEVER`**

이유 (우선순위):
1. **R05 KILLER** — 렌트(`(비,대여)사업용`) 출고 차량. summary/driveCaution/caution/enlogData/release.use **5개 신호 동시 양성**. 렌트카는 일반적으로 가혹 운행 + 다수 운전자 노출.
2. **R08 KILLER** — 자차보험 공백 2건, 그중 1건이 **5개월 단일 공백** 후 곧바로 동일 날짜 3건의 대형 타차가해 사고 발생 (매우 의심스러운 시퀀스).
3. **R07 FAIL** — 법인 출고 + 5회 소유자 변경 (관측 최대치). 1인 신조와는 정반대.
4. **R10 누적 대형** — 5건 사고 누적 보험금 약 1,820만원 (매가 107%), 단일 사건 보험금 984만원.
5. **R09 WARN** — `partPrice: "-"` 결측 1건.
6. **R03 FAIL** — 미진단 외제차 8년차.

**대조군 의의**: 본 샘플은 "딜러 + 렌트 + 다수 사고 + 자차 공백" 4종 위험 신호가 동시에 켜지는 **닥신 룰셋의 종합 스트레스 테스트**. 11개 룰 중 4개가 동시 트리거. 닥신 UI 가 multi-killer 케이스를 어떻게 시각화할지 (예: "🚫 NEVER × 2 KILLER + 2 FAIL") 디자인 기준이 될 수 있음.
