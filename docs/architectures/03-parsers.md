# 파서 계층

> `src/core/parsers/`

모든 파서는 순수 함수이며 I/O가 없다. raw JSON 또는 window-like 객체를 받아 `FieldStatus<T>`를 반환한다.

---

## state.ts — 페이지 상태 추출

> `src/core/parsers/encar/state.ts`

`__PRELOADED_STATE__`와 `__NEXT_DATA__`에서 차량 기본 정보를 추출한다.

### 주요 함수

| 함수 | 입력 | 출력 |
|------|------|------|
| `extractBase(root)` | window-like 객체 | `FieldStatus<EncarCarBase>` |
| `extractDetailFlags(root)` | window-like 객체 | `FieldStatus<DetailFlags>` |

### 추출 경로

1. 우선: `root.__PRELOADED_STATE__.cars.base` / `root.__PRELOADED_STATE__.cars.detailFlags`
2. 폴백: `root.__NEXT_DATA__.props.pageProps` → `deepFind()` (깊이 6)로 Next.js 하이드레이션 호환

---

## api-record.ts — 보험이력 API

> `src/core/parsers/encar/api-record.ts`

**엔드포인트:** `api.encar.com/v1/readside/record/vehicle/{vehicleId}/open?vehicleNo={vehicleNo}`

### RecordApi 주요 필드

| 필드 | 용도 |
|------|------|
| `myAccidentCnt` / `myAccidentCost` | R10 — 내 과실 사고 |
| `otherAccidentCnt` / `otherAccidentCost` | R10 — 상대 과실 사고 |
| `ownerChangeCnt` | R07 — 소유자 변경 횟수 |
| `robberCnt` | R06 — 도난 |
| `totalLossCnt` | R06 — 전손 |
| `floodTotalLossCnt` | R06 — 침수 전손 |
| `floodPartLossCnt` | R06 — 침수 분손 |
| `government` / `business` / `loan` | R05 — 관용/택시/렌트 |
| `notJoinDate1..5` | R08 — 보험 미가입 기간 |

### 보험 공백 파싱

`getInsuranceGapPeriods(record)` — `notJoinDate1..5` 문자열을 파싱한다.

- 입력 형식: `"YYYYMM~YYYYMM"` (예: `"202301~202306"`)
- 출력: `{ from: 'YYYY-MM', to: 'YYYY-MM' }[]`
- `monthsBetweenInclusive()`로 공백 개월 수 계산

---

## api-diagnosis.ts — 엔카진단 API

> `src/core/parsers/encar/api-diagnosis.ts`

**엔드포인트:** `api.encar.com/v1/readside/diagnosis/vehicle/{vehicleId}`

### DiagnosisApi 구조

```typescript
{ vehicleId: string, items: DiagnosisItem[] }
```

### getFrameIntact(d) — 프레임 무사고 판정

우선순위:
1. `CHECKER_COMMENT` 항목의 `result` 텍스트에서 `무사고` → `true`, `사고` → `false`
2. 폴백: 모든 `resultCode` 검사 — 전부 `NORMAL` → `true`, `EXCHANGE` 또는 `REPAIR` 존재 → `false`

---

## api-inspection.ts — 성능점검 API

> `src/core/parsers/encar/api-inspection.ts`

**엔드포인트:** `api.encar.com/v1/readside/inspection/vehicle/{vehicleId}`

정부 의무 성능점검 보고서를 파싱한다.

### getFrameFromInspection(ins) — 프레임 손상 판정

- `master.accdient` 필드를 읽음 (API 오타 — `accident`이 아님)
- 반환: `{ hasDamage: boolean, simpleRepair: boolean } | null`
- `simpleRepair=true`는 볼트온 패널 교체로, 프레임 손상을 의미하지 않음

---

## index.ts — orchestrate()

> `src/core/parsers/encar/index.ts`

모든 파서를 조합하는 오케스트레이터.

### 입력

| 파라미터 | 설명 |
|----------|------|
| `url` | 매물 URL |
| `carId` | 차량 ID |
| `preloadedRoot` | `__PRELOADED_STATE__` 포함 객체 |
| `recordJson` | record API raw JSON |
| `diagnosisJson` | diagnosis API raw JSON |
| `inspectionJson` | inspection API raw JSON |
| `httpStatus` | 엔드포인트별 `FetchStatus` |
| `loginState` | 로그인 상태 |

### resolveApi() 헬퍼

HTTP 상태에 따라 파서 호출 여부를 결정한다:
- `ok` → 파서 호출
- `not_found` / `skipped` → 정상 처리 (개인 매물에서 404는 예상 동작)
- `unauthorized` / `error` → `failed(reasonForStatus(status))` 반환, 파서 미호출

### 출력

완전한 `EncarParsedData` 객체 (모든 raw 필드가 `FieldStatus<T>`로 채워짐).

---

## 파서 유틸리티

> `src/core/parsers/utils/`

| 파일 | 함수 | 용도 |
|------|------|------|
| `validate.ts` | `isPlainObject()` | 순수 객체 검증 |
| `validate.ts` | `isObjectLike()` | 객체 유사 검증 |
| `text.ts` | `wonToNumber()` | 원 단위 문자열 → 숫자 변환 |
| `text.ts` | `splitLines()` | 줄 분리 |
| `text.ts` | `formatYearMonth()` | 연월 포맷 |
