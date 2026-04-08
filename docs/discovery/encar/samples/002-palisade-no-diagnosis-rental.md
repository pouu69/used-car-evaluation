# Sample 002 — 더 뉴 팰리세이드 캘리그래피 (엔카진단 X + 렌터카 + 자차보험 공백)

**Status**: Confirms R03, R05, R08 triggers; introduces new schema details (리콜, insurance.type, enlogData tags)
**Captured**: 2026-04-07
**Verdict**: `NEVER` (3 killer rules)

## URL

- Main listing: https://fem.encar.com/cars/detail/41709800
- History page: https://car.encar.com/history?carId=41709800

## Basic Info

| Field | Value |
|---|---|
| 차량번호 | 271모1136 |
| 제조사 | 현대 |
| 모델 | 더 뉴 팰리세이드 |
| 등급 | 가솔린 3.8 4WD / 캘리그래피 |
| 연식 | 2023/02 (23년형) |
| 주행거리 | 33,366km |
| 연료 | 가솔린 |
| 색상 | 흰색 |
| 본체 | SUV (7인승) |
| 신차가 정가 | 5,309만원 |
| 신차 출고가 | 5,573만원 |
| 현재 판매가 | **4,120만원** (신차대비 ~78%) |
| 지역 | 경기 용인시 기흥구 |
| 딜러 | 김효준 / 윈윈모터스 |

## 평가 결과

| 룰 | 상태 | 근거 |
|---|---|---|
| R01 보험이력 공개 | ✅ PASS | `detailFlags.isInsuranceExist=true` |
| R02 성능점검 공개 | ✅ PASS | `detailFlags.isHistoryView=true` |
| **R03 엔카진단** | ❌ **KILLER FAIL** | `isDiagnosisExist=false`, `preVerified=false`, `trust=[]` |
| R04 프레임 무사고 | ⚪ UNKNOWN | `cars.inspect` 비어있음 (lazy load 필요) |
| **R05 렌트/택시 이력** | ❌ **KILLER FAIL** | `uiData.item.drive.caution.rent=true` |
| R06 전손/침수/도난 | ✅ PASS | `theft=false`, `uiData.enlogData.detail`에 전손/침수 태그 없음 |
| R07 1인 신조 | ⚪ UNKNOWN | 법인(렌터카) → 개인 소유자 0 |
| **R08 자차보험 공백** | ❌ **KILLER FAIL** | 35개월 미가입 (2023/02 ~ 2026/01) |
| R09 수리비 미확정 | ✅ PASS | 모든 이력 확정 |
| R10 자잘한 사고 처리 | ✅ BONUS | 38만원 내차피해 보험처리 있음 |
| R11 가격 적정성 | ✅ PASS | 신차대비 78% (정상) |

**판정**: `NEVER` (킬러 3개: R03, R05, R08)

## 신규 스키마 발견

### 1. `insurance[].contents[].type` 구분

```typescript
type InsuranceEntryType = 'insurance' | 'repair';

interface InsuranceEntry {
  type: 'insurance';         // 실제 보험처리 (사고)
  name: string;              // "보험처리 (내차피해)" 등
  insurance: {
    date: string;
    partPrice: string;       // "3만원"
    laborPrice: string;      // "12만원"
    paintingPrice: string;   // "23만원"
    detailList: Array<{
      name: '교환' | '탈착' | '도장' | '수리';
      value: string[];       // 부위 리스트
    }>;
  };
}

interface RepairEntry {
  type: 'repair';            // 일반 정비만
  name: string;              // "일반 정비"
  repair: string[];          // 부위 리스트
}
```

**의미**: `type='insurance'` 엔트리만 실제 사고 신호. `type='repair'`는 정비이력일 뿐 사고로 카운트하면 안 됨.

### 2. `layerData.flag` 값들

| flag | 의미 |
|---|---|
| `CORPORATION` | 법인 명의 신차 출고 (→ 렌터카 가능성) |
| `DEALER` | 매매업자 거래이전 (→ 딜러 리세일) |
| `USE_OTHER_INSURANCE` | 보험처리 타입 구분 |
| `리콜대상` (한글) | 리콜 대상 |
| `리콜완료` (한글) | 리콜 완료 |

### 3. 🆕 리콜 이력

가이드 체크리스트에는 없지만 타임라인에 등장:

```json
{
  "title": "[동력전달장치 기타]\n리콜 대상에 포함",
  "sub": "리콜완료",
  "layerData": {
    "flag": "리콜완료",
    "content": [
      { "name": "리콜 게시일자", "value": "2023년 09월 08일" },
      { "name": "결함내용", "value": "<p>...HTML...</p>" },
      { "name": "대상장치", "value": "동력전달장치 기타" },
      { "name": "시정방법", "value": "<p>...</p>" }
    ]
  }
}
```

**의사결정 필요**: 리콜을 새 룰로 추가할지, 부가 정보로만 노출할지.

### 4. `enlogData` CSV 태그 카탈로그

Sample 001: `new_release_corporate,noinsured,car_inspection,repair_history,change_owners`
Sample 002: `new_release_corporate,noinsured,recall,car_inspection,damage_mycar,repair_history,change_owners`

**확인된 태그**:
- `new_release_corporate` — 법인 명의 신차 출고
- `noinsured` — 자차보험 미가입
- `recall` — 리콜 이력
- `car_inspection` — 정기검사 이력
- `repair_history` — 정비/수리 이력
- `damage_mycar` — 내차 피해 보험처리
- `change_owners` — 소유자변경

**enlogData.text 요약 라벨**:
- Sample 001: `"no_insurance_rent"`
- Sample 002: `"use_rent"`

→ **엔카가 자체적으로 만든 위험 카테고리 라벨 시스템**. 파서가 직접 신호 도출하기 전에 이 태그를 Priority 1 signal로 쓸 수 있음.

### 5. 🚨 데이터 품질 이슈: 비정상 날짜

Sample 002 타임라인 항목:

```json
{
  "date": "00년 01월",
  "contents": [{
    "title": "정비/수리 이력",
    "layerData": {
      "content": [
        { "name": "입고일자", "value": "2025년 04월 09일" },
        { "name": "완료일자", "value": "3000년 01월 16일" }  // ← 버그
      ]
    }
  }]
}
```

**파서 요구사항**: 날짜 필드는 strict parse 하지 말고 string으로 받은 뒤 별도 검증 단계에서 필터. Zod 스키마는 `z.string()`로 받고 후처리에서 `parse → fallback`.

## 두 샘플 비교 (diff view)

| 항목 | Sample 001 (스포티지) | Sample 002 (팰리세이드) |
|---|---|---|
| 엔카진단 | ✅ Yes | ❌ No |
| 홈서비스 | ✅ Yes | ❌ No |
| 렌터카 | ✅ Yes | ✅ Yes |
| 자차보험 공백 | 49개월 | 35개월 |
| 리콜 | 없음 | 있음 (동력전달장치, 완료) |
| 보험처리 건수 | 0 | 1건 (38만원) |
| 수리이력 건수 | 6 | 2 |
| 소유자변경 | 2 (매매업자) | 2 (매매업자) |
| enlogData.text | `no_insurance_rent` | `use_rent` |

## 스크린샷

- `002-palisade-history.png`
