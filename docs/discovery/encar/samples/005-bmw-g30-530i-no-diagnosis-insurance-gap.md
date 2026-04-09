# Sample 005 — BMW 5시리즈 G30 530i xDrive M Sport Plus (엔카진단 없음 + 자차보험 공백 + 대형 수리)

**Captured**: 2026-04-09
**Verdict**: `NEVER` (R08 killer) + 다수 WARN
**Significance**: 첫 외제 비(非)엔카진단 매물 · `release` 스키마 확장 관찰 (nation/use/fuel/연비) · 대형 부품비 수리 사례

## URL
- Main: https://fem.encar.com/cars/detail/41268864
- History: https://car.encar.com/history?carId=41268864

## Basic Info
| Field | Value |
|---|---|
| vehicleId | 41268864 |
| vin | WBAJR9102LWW55272 |
| 차량번호 | 136노7771 |
| 제조사/모델 | BMW / 5시리즈 (G30) |
| 등급 | 530i xDrive M 스포츠 플러스 |
| 연식 | 2019/11 (2020년형, 6년차) |
| 주행거리 | 67,668km |
| 가격 / 신차가 | **3,100만원 / 8,060만원** (38.5%) |
| `domestic` | false |
| `importType` | `REGULAR_IMPORT` |
| preVerified | **false** |
| diagnosisCar | **false** ← 🆕 엔카진단 없음 외제차 |
| trust | `[]` (빈 배열) |
| 딜러 | 홍석범 / 카멘토 (경기 수원, `isPartneredVehicle=true`) |
| 조회수 / 관심 | 1,973 / 13 |
| 등록/최초광고 | 2026-01-02 / 2026-03-03 |

## 🧮 룰 판정

| 룰 | 상태 | 근거 |
|---|---|---|
| R01 보험이력 공개 | ✅ PASS | `isInsuranceExist=true` |
| R02 성능점검 공개 | ✅ PASS | `isHistoryView=true` |
| R03 엔카진단 | ❌ **FAIL** | `isDiagnosisExist=false`, `preVerified=false`, `diagnosisCar=false` |
| R04 프레임 무사고 | ⚪ N/A | 엔카진단 없어 DOM 진단 배지 부재 — S5 inspect 페이지 확인 필요 |
| R05 렌트/택시 | ✅ PASS | `driveCaution.rent=false`, `commercial=false`, `public=false` |
| R06 전손/침수/도난 | ✅ PASS | `driveCaution.theft=false` |
| R07 1인 신조 | ❌ FAIL | 소유자변경 다수 (개인↔매매업자 왕복, `driveContents` 8행) |
| **R08 자차보험 공백** | ❌ **KILLER** | `caution.no_insurance="있음"` |
| R09 수리비 미확정 | ⏳ TODO | accident 리포트(S6) 확인 필요 |
| R10 자잘한 사고 | ❌ **WARN (대형)** | 25-02 부품비 **698만원** + 24-12 파손 광범위 — 외제차 200만 기준 초과 |
| R11 가격 적정성 | ✅ PASS | 신차대비 38.5% — 6년차 외제차 정상 범위 |
| 🆕 R12 리콜 | ⚠️ WARN | `caution.recall="3건"` + `enlogData.detail` 에 `recall` |
| 🆕 R13 노후/고주행 | ✅ PASS | 6년차 / 67k km — 건전 |

## 🆕 이 샘플의 핵심 기여

### 1. 엔카진단 없는 외제차 스키마 관찰

기존 샘플 (001~004) 은 모두 `diagnosisCar=true`. 본 샘플은:
```json
{
  "advertisement": {
    "preVerified": false,
    "diagnosisCar": false,
    "trust": []       // 빈 배열 — 기존 샘플은 ["Warranty"] 등
  },
  "detailFlags": {
    "isDiagnosisExist": false
  }
}
```

**파서 영향**: DOM에서 `프레임무사고 확인` 배지를 기대하면 안 됨. R04 는 S5 성능점검표로만 판정 가능 → `FieldStatus.value=null` or `parse_failed{reason:'no_diagnosis'}` 처리.

### 2. `release` 스키마 확장 — 새 필드 6종

001~004 의 `release` 는 `{ date, owner, flag, storePrice }` 구조였는데, 본 샘플은:
```json
{
  "date": "2019년 07월 12일",
  "nation": "오스트리아",                  // 🆕 원산지 국가 (수입차에 한해)
  "use": "(비,대여)사업용",                // 🆕 출고 당시 용도 분류
  "fixedPrice": "정보없음",                // 🆕 (출고 정가)
  "storePrice": "정보없음",
  "fuel": "휘발유",                        // 🆕
  "cityConsumption": "9.1 km/L",           // 🆕 도심연비
  "expresswayConsumption": "12.3 km/L"     // 🆕 고속연비
}
```

**주의**: `owner`, `flag` 필드가 **누락**. 신차 출고가 개인/법인인지 판정하려면 **타임라인의 첫 이벤트** (`19년 11월 - 신차 출고(개인 명의)`) 를 봐야 한다.

**제안**: `ReleaseInfo` 타입을 optional-rich 로 재정의.
```typescript
interface ReleaseInfo {
  date: string;
  owner?: string;            // 구버전 샘플
  flag?: string;             // 구버전 샘플
  storePrice?: string;
  fixedPrice?: string;       // 🆕
  nation?: string;           // 🆕 (수입차만)
  use?: string;              // 🆕
  fuel?: string;             // 🆕
  cityConsumption?: string;  // 🆕
  expresswayConsumption?: string; // 🆕
}
```

### 3. `driveContents` 매매업자 거래이전 패턴

8행 중 3행이 `company: true` (매매업자 거래이전). 이 행들의 특징:
```json
{ "user": null, "company": true, "mileage": "0km" (또는 "12km") }
```

**R07 1인 신조 집계 규칙**:
- `company: true` 인 행은 **실소유자 카운트에서 제외** (딜러 in-transit)
- 순수 `company: false && user === ""` 행의 수가 실제 소유주 수
- 본 샘플: 5명의 순수 소유자 → `R07 FAIL`

### 4. 대형 부품비 수리 케이스 (R10 threshold 검증)

| 날짜 | 부품비 | 공임 | 도장 | 합계 | 비고 |
|---|---|---|---|---|---|
| 2022-07-29 | - | 43만 | 50만 | **93만** | 경미 |
| 2024-12-15 | 135만 | 103만 | 121만 | **359만** | 범퍼/헤드램프/펜더 광범위 |
| 2025-02-25 | **698만** | 120만 | 120만 | **938만** | 후면 파손 추정 |

합계 약 **1,390만원** — 매매가 3,100만원의 **44.8%**.

**R10 룰 강화 제안**:
- 외제차 단일 사고 부품비 > 500만원 → `NEVER` 후보 (추가 킬러 검토)
- 누적 수리비 > 매매가의 30% → `WARN (severe)`

### 5. `insurance[].contents[].insurance.detailList` 정식 스키마 확인

```typescript
interface InsuranceDetail {
  date: string;
  partPrice: string;      // "135만원" | "-" (없을 땐 하이픈)
  laborPrice: string;
  paintingPrice: string;
  detailList: Array<{
    name: '판금' | '탈착' | '조정' | '수리' | '오버홀' | '교환' | '도장';
    value: string[];      // 부위 리스트
  }> | null;              // null 가능 — 요약 사고 (detailList 누락)
}
```

**🆕 관찰된 `detailList.name` 값**: `판금`, `탈착`, `조정`, `수리`, `오버홀` (이전 샘플: `교환`, `탈착`, `도장`, `수리`). **화이트리스트 확장 필요**.

### 6. `enlogData.text === "no_change"` ≠ 안전

Sample 004 에서 `no_change` 는 "용도 변경 없음" = 긍정 신호로 해석했지만, 본 샘플은 `no_change` + `no_insurance=있음` + 대형 수리. **`text` 는 용도변경 플래그일 뿐, 종합 안전도와 무관**. 파서에서 긍정 가중치로 쓰면 안 됨.

### 7. `summary` 긍정 메시지 오인 위험

```
"용도 변경 이력이 없는 차량이네요!"
```
이 문구만 보면 깨끗해 보이지만:
- 자차보험 공백 존재 (R08 킬러)
- 대형 수리 이력 (R10 심각)

**UI 결정**: `summary` 는 **표시는 하되 판정 근거로는 절대 사용 금지**. 사용자에게는 룰 엔진 결과가 우선.

### 8. `contact.isOwnerPartner=true` — 파트너 딜러 플래그

`detailFlags.isDealer=true` + `contact.isOwnerPartner=true` + `partnership.isPartneredVehicle=true`. 엔카 파트너 딜러 매물은 별도 신뢰 가중치가 있을 수 있음 (긍정/부정 미결). 사용자 가이드에 질의 필요.

### 9. 🆕 성능점검 데이터 스키마 청사진 — `/v1/readside/inspection/vehicle/{id}` 응답 관찰

엔카 성능점검 페이지(`/cars/report/inspect/{id}`)는 React SPA 라서 `__NEXT_DATA__`/`__PRELOADED_STATE__` 가 없고, **XHR로 `https://api.encar.com/v1/readside/inspection/vehicle/{id}` 를 호출**해서 얻은 JSON을 React state에 주입한다.

> ⚠️ **직접 호출 불가**: 해당 API는 `api.encar.com` 오리진의 CORS 헤더만 허용해서 `fem.encar.com` 컨텍스트(= content script)에서 `fetch()` 로 직접 호출하면 `Failed to fetch` 로 거부된다. 브라우저에서 URL을 직접 방문해야만 200 을 받을 수 있다.
>
> 따라서 실서비스(익스텐션)에서는 **직호출 대신** content script 에서 `window.fetch` / `XMLHttpRequest.prototype.open` 을 monkey-patch 해 페이지 자신이 호출하는 응답을 **가로채는** 전략을 택한다. 이렇게 하면 same-origin 이라 CORS 우회 없이도 동일 JSON 을 얻을 수 있다.

그럼에도 이 스키마를 문서화하는 이유: DOM 파서가 뽑아야 할 필드의 **완전 카탈로그**이자, 추후 가로채기 구현 시 응답 타입 정의 원본이 되기 때문이다.

**`master.detail` — R 룰 직결 핵심 필드**
```typescript
interface InspectMasterDetail {
  recordNo: string;              // 제시번호 '2026000486'
  firstRegistrationDate: string; // 'YYYYMMDD'
  mileage: number;
  motorType: string;             // 'B46B20B'
  vin: string;
  guarantyType: { code: '1'|'2'; title: '자가보증'|'보험사보증' };
  carStateType: { code: '1'|'2'|…; title: '양호'|… };       // 종합 상태
  tuning: boolean;
  tuningStateTypes: Array<{ code: string; title: string }>;
  seriousTypes: Array<{ code: string; title: string }>;     // 특별이력
  usageChangeTypes: Array<{ code: string; title: string }>; // 용도변경
  recall: boolean;                                           // R12 🆕 (uiData와 별개)
  waterlog: boolean;                                         // 🆕 R06 침수 플래그!
  comments: string;                                          // 점검자 코멘트
  inspName: string;                                          // 점검자
  noticeName: string;                                        // 고지자
  engineCheck: 'Y'|'N';
  trnsCheck: 'Y'|'N';
  version: string;                                           // 'V200922'
}

interface InspectMaster {
  supplyNum: string;
  accdient: boolean;        // (sic: typo in API) 사고이력 있음/없음 — R10
  simpleRepair: boolean;    // 단순수리 있음/없음
  detail: InspectMasterDetail;
}
```

**`outers[]` — 사고·교환·수리 부위 (R04/R10 근거)**
```typescript
interface OuterPart {
  type: { code: string; title: string };   // 'P041' '트렁크 리드', 'P181' '리어 패널' …
  statusTypes: Array<{ code: 'X'|'W'|…; title: '교환(교체)'|'판금'|'부식'|'흠집'|'요철'|'손상' }>;
  attributes: string[];                     // 'RANK_ONE' | 'RANK_A' | …
}
```

본 샘플 (41268864) 의 `outers`:
```json
[
  { "type": { "code": "P041", "title": "트렁크 리드" }, "statusTypes": [{ "code": "X", "title": "교환(교체)" }], "attributes": ["RANK_ONE"] },
  { "type": { "code": "P181", "title": "리어 패널" }, "statusTypes": [{ "code": "X", "title": "교환(교체)" }], "attributes": ["RANK_A"] }
]
```

⭐ **강력한 교차 검증**: `outers[]` 의 "리어 패널/트렁크 리드 교환" 은 히스토리(S3) 25-02 보험건의 **부품비 698만원** 과 정확히 일치. 즉 `outers` 와 `insurance[]` 는 **동일 사건을 두 관점에서** 보여준다. 파서는 둘을 대조해 일관성 검증 가능.

**`inners[]` — 자동차 세부상태 트리 (자기진단→원동기→…)**
```typescript
interface InnerNode {
  type: { code: string; title: string };     // 'S01' '원동기', 's004' '실린더 커버' …
  statusType: { code: string; title: string } | null;
  statusItemTypes: Array<{ code: string; title: string }>;  // 가능 값의 화이트리스트
  description: string | null;
  children?: InnerNode[];
}
```

상위 코드: `S00 자기진단 | S01 원동기 | S02 변속기 | S03 동력전달 | S04 조향 | S05 제동 | S06 전기 | S07 연료`

**statusType 코드 카탈로그 (이 샘플에서 관측)**:
- `1` 양호 · `2` 적정 · `3` 없음 · `4` 미세누수 · `5` 누수 · `6` 미세누유 · `7` 누유 · `8` 부족 · `9` 과다 · `10` 불량 · `11` 있음

**파서 영향 (DOM 폴백 설계)**

`innerText` 파싱 시 등장하는 단어들이 전부 이 카탈로그와 1:1 매칭되므로, 향후 `docs/discovery/encar/fixtures/` 에 이 raw JSON을 저장하고 `src/core/parsers/encar/inspect-report.ts` 의 DOM 파서와 동일 결과를 내는지 스냅샷 테스트로 고정할 수 있다.

### 10. Fetch Interceptor 구현 힌트 (content script)

```typescript
// early — injected as <script> in the page context before React hydration
(() => {
  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const res = await origFetch(...args);
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    if (/\/v1\/readside\/inspection\/vehicle\/\d+$/.test(url)) {
      res.clone().json().then(data => {
        window.postMessage({ type: 'ENCAR_INSPECTION', carId: url.match(/\d+$/)?.[0], data }, '*');
      });
    }
    return res;
  };
})();
```
Content script 는 `window.addEventListener('message', ...)` 로 수신 → background 로 릴레이.

### 11. R06 침수 룰 단순화

기존 룰 R06 은 `uiData.item.drive.caution.theft` + `enlogData.detail` CSV 를 찾아 침수/전손 여부를 추정했다. 하지만 `master.detail.waterlog: boolean` 이 **공식 단일 필드** 로 침수 여부를 직접 제공한다. 권장 판정 로직:

```typescript
function r06(facts) {
  if (facts.inspect?.waterlog === true) return 'NEVER_FAIL';
  if (facts.history?.driveCaution?.theft === true) return 'WARN';
  if (/\b(flood|total_loss)\b/.test(facts.history?.enlogDataDetail ?? '')) return 'WARN';
  return 'PASS';
}
```

## 📸 Screenshot

- `005-bmw-g30-history.png` — 히스토리 페이지 전체 (20년형, 8 drive contents, 21 timeline events)

## Raw 요약 (저장용)

```json
{
  "carId": 41268864,
  "priceRatio": 0.385,
  "detailFlags": { "isInsuranceExist": true, "isHistoryView": true, "isDiagnosisExist": false },
  "driveCaution": { "rent": false, "commercial": false, "public": false, "theft": false, "owner": false },
  "caution": { "no_insurance": "있음", "recall": "3건" },
  "enlogData": {
    "detail": "new_release_personal,change_owners,damage_mycar,recall,car_inspection,noinsured,repair_history",
    "text": "no_change"
  },
  "insurancePartPriceMax": 698,
  "ownerTransitions": 5
}
```
