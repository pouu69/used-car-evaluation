# daksin-car — 설계 문서 (Final)

**Version**: v2 (post-API-pivot)
**Date**: 2026-04-08
**Status**: MVP 동작 확인 — fem.encar.com 매물에서 11 룰 전부 평가
**Codename**: `dakshin-car` (제품명 TBD)
**Related**:
- Discovery: [docs/discovery/encar/README.md](../discovery/encar/README.md)
- Implementation plan: [docs/plan/IMPLEMENTATION.md](../plan/IMPLEMENTATION.md)
- Plan review: [docs/plan/REVIEW.md](../plan/REVIEW.md)
- Code review: [docs/plan/CODE_REVIEW.md](../plan/CODE_REVIEW.md)
- Spec review: [SPEC_REVIEW.md](./SPEC_REVIEW.md)

---

## Section 1 — Product Overview

### 1.1 한 줄 정의
엔카 매물 페이지에서 **닥신 11 룰 체크리스트**를 자동 평가해, 함정 매물을 단 한 번의 클릭 없이 걸러내는 Chrome Extension.

### 1.2 해결하려는 문제
엔카 메인 페이지는 "프레임무사고", "엔카진단 통과", "보험이력 0건" 같은 **긍정 배지**만 강조한다. 결정적인 위험 (렌트 이력, 자차보험 공백, 미진단) 은 별도 페이지 혹은 로그인 뒤에 숨어있고, 사용자는 매물 하나를 11 룰로 수동 평가해야 해서 귀찮음에 걸려 함정 매물에 빠진다.

### 1.3 핵심 가치
1. **자동 트리거** — 매물 페이지 오픈과 동시에 평가 시작
2. **위험 신호 우선 노출** — pass 룰이 아니라 killer/warn 부터 보여줌
3. **결정론적·검증 가능** — AI 추론이 아니라 **고정된 코드 + 구조화 JSON** 으로 판정
4. **사용자 주권** — 킬러 룰은 하드 비토 하지만 7일간 ack 로 무시 가능

### 1.4 비목표
- 시세 예측/리세일 추정 등 AI 통계 분석
- 엔카 외 사이트 (KCar, KB차차차) — MVP 범위 외
- 모바일 앱·웹사이트·서버 백엔드 — 순수 Chrome Extension

### 1.5 성공 지표 (MVP)
- ✅ 4개 디스커버리 샘플의 verdict 100% 일치
- ✅ 로그인 없이도 R01~R10 거의 전부 평가 가능 (API 덕분)
- ✅ 사용자 ack 7일 retention 동작
- ✅ 여러 탭 동시 평가 시 race condition 없음
- ✅ SPA 네비게이션 시 자동 재평가

---

## Section 2 — 아키텍처 개요

### 2.1 4-Layer 도메인 모델

```
┌────────────────────────────────────────────────────────────┐
│ Layer A — EncarParsedData          (site-specific, raw)    │
│   raw.base           from __PRELOADED_STATE__.cars.base    │
│   raw.detailFlags    from __PRELOADED_STATE__.cars.flags   │
│   raw.recordApi      from api.encar.com/record/vehicle/…   │
│   raw.diagnosisApi   from api.encar.com/diagnosis/vehicle/…│
│   raw.inspectionApi  from api.encar.com/inspection/vehicle/│
│   각 필드는 FieldStatus<T> 로 감싸짐                        │
└──────────────────┬─────────────────────────────────────────┘
                   │ encarToFacts  (bridge, pure)
                   │   F1: 법인 ≠ 렌트 불변식
                   │   F2: 사고 금액은 record 정수만 사용
                   │   F3: 날짜는 string 그대로 통과
                   ▼
┌────────────────────────────────────────────────────────────┐
│ Layer B — ChecklistFacts           (site-agnostic)         │
│   11개 facts, 모두 FieldStatus<T>                          │
│   (사이트 바뀌어도 이 레이어는 불변)                          │
└──────────────────┬─────────────────────────────────────────┘
                   │ evaluate(facts, registry)  (pure)
                   ▼
┌────────────────────────────────────────────────────────────┐
│ Layer D — RuleReport                                       │
│   { verdict, score, results, killers, warns }              │
└──────────────────┬─────────────────────────────────────────┘
                   │ chrome.runtime broadcast
                   ▼
┌────────────────────────────────────────────────────────────┐
│ React Side Panel — hero + filter chips + category cards    │
└────────────────────────────────────────────────────────────┘
```

**사이트 추가 = Layer A 파서 + bridge 함수만 추가**. Layer B/D/UI 는 한 줄도 안 건드린다.

### 2.2 FieldStatus<T> 5 상태

| kind | 의미 | 룰 처리 | UI 표시 |
|---|---|---|---|
| `value` | 정상 추출됨 | 룰 평가 | 색상별 |
| `hidden_by_dealer` | 딜러가 의도적 비공개 | `fail` | 🔴 빨강 |
| `parse_failed{reason}` | 파서 한계 / login_required / 네트워크 실패 | `unknown` | ⚪ 회색 + reason 텍스트 |
| `loading` | 수집 진행 중 | `unknown` | 🌀 스피너 |
| `timeout` | 초과 | `unknown` | ⏱ 회색 |

> **"딜러 비공개" vs "파서 실패" 를 분리** 하는 게 핵심 — 같은 "데이터 없음" 상태도 사용자에게 전혀 다른 신호로 보여준다.

### 2.3 모듈 맵

```
src/
├─ core/
│  ├─ types/           FieldStatus, ParsedData, ChecklistFacts, RuleTypes
│  ├─ parsers/encar/   state.ts (__PRELOADED_STATE__ + __NEXT_DATA__ fallback)
│  │                   api-record.ts, api-diagnosis.ts, api-inspection.ts
│  │                   index.ts (orchestrator)
│  ├─ parsers/utils/   text.ts (wonToNumber, splitLines)
│  ├─ bridge/          encar-to-facts.ts (불변식 본거지)
│  ├─ rules/           r01..r11 + evaluate + REASON_LABEL 한글 매핑
│  ├─ storage/         db.ts (Dexie 4 tables + sweepExpired)
│  └─ messaging/       protocol.ts (Message union)
├─ background/
│  ├─ index.ts                 service worker — onMessage, watchdog, caching
│  └─ main-world-collector.ts  chrome.scripting.executeScript target
├─ content/fem-encar/
│  ├─ main-world.ts    world:'MAIN', reads state + api.encar.com fetches
│  └─ index.ts         world:'ISOLATED', relays payload to background
├─ sidepanel/
│  ├─ App.tsx          React 18, verdict hero + chip filter + category cards
│  ├─ rule-meta.ts     UI-only icon/category/shortTitle per ruleId
│  ├─ index.html
│  └─ main.tsx
├─ manifest.ts         CRXJS manifest v3
└─ __fixtures__/       hand-crafted sample payloads for tests
```

---

## Section 3 — 데이터 소스 맵 (Post-Pivot)

### 3.1 엔카 엔드포인트 발견 결과

Phase 0 디스커버리에서 처음 발견한 HTML report 페이지 (`/cars/report/accident/{id}` 등) 는 **client-side rendering SPA** — background fetch 가 1~2KB shell HTML 만 받아오고 실데이터는 없음. 그래서 네트워크 탭을 뒤져 **진짜 API 엔드포인트** 발견:

| 엔드포인트 | 반환 | 커버 룰 | 로그인 |
|---|---|---|---|
| `__PRELOADED_STATE__.cars.base` (in-page) | 제조사·모델·연식·신차가·vehicleId·vehicleNo | R11 + 상관 정보 | X |
| `__PRELOADED_STATE__.cars.detailFlags` (in-page) | isInsuranceExist/isHistoryView/isDiagnosisExist | R01, R02, R03 | X |
| `api.encar.com/v1/readside/record/vehicle/{vid}/open?vehicleNo={no}` | 사고/소유자/보험공백 구조화 정수 | R05, R06, R07, R08, R09, R10 | **X** (open=true 필드) |
| `api.encar.com/v1/readside/diagnosis/vehicle/{vid}` | 진단 items 배열 (CHECKER_COMMENT 포함) | R04 | X |
| `api.encar.com/v1/readside/inspection/vehicle/{vid}` | 성능점검 구조화 (simpleRepair/tuning/recall 등) | 보조 | X |

### 3.2 record API 필드 상세

```typescript
interface RecordApi {
  myAccidentCnt: number;      // R10 내차 피해 건수
  otherAccidentCnt: number;   // R10 타차 가해 건수
  ownerChangeCnt: number;     // R07 소유자 변경 (최초 owner 이미 제외됨!)
  robberCnt: number;          // R06 도난
  totalLossCnt: number;       // R06 전손
  floodTotalLossCnt: number;  // R06 침수 전손
  floodPartLossCnt: number | null;
  government: number;         // R05 관용
  business: number;           // R05 영업(택시)
  loan: number;               // R05 렌트
  carNoChangeCnt: number;
  myAccidentCost: number;     // R10 총 금액 (원)
  otherAccidentCost: number;
  notJoinDate1..5: string | null;  // R08 자차보험 공백기간 "YYYYMM~YYYYMM"
  accidentCnt: number;
  accidents: Array<{ type, date, insuranceBenefit, partCost, laborCost, paintingCost }>;
}
```

### 3.3 diagnosis API 활용

```typescript
// CHECKER_COMMENT item 의 result 문자열에서 판정 추출
const getFrameIntact = (d: DiagnosisApi): boolean | undefined => {
  const checker = d.items.find(i => i.name === 'CHECKER_COMMENT');
  if (/무사고/.test(checker.result)) return true;
  if (/사고/.test(checker.result)) return false;
  // fallback: 모든 part item 이 NORMAL 이면 true
};
```

---

## Section 4 — 수집 파이프라인 (실제 동작)

### 4.1 주 경로 (Content Script 주도)

```
[1] 사용자가 fem.encar.com/cars/detail/* 오픈
     │
     ▼
[2] main-world content script 주입 (run_at: document_idle, world: 'MAIN')
     │  • window.__PRELOADED_STATE__ 직접 읽기
     │  • #__NEXT_DATA__ JSON 백업 읽기
     │  • base.vehicleId + base.vehicleNo 추출
     │  • api.encar.com 3개 병렬 fetch (각 7초 타임아웃)
     │  • ❗ credentials 옵션 없이 호출 (same-site 쿠키 자동)
     │  • 공유 inflight Promise — 중복 fetch 방지
     │
     ▼  window.postMessage
[3] isolated content script (world: 'ISOLATED')
     │  • reqId 기반 매칭으로 payload 수신 (15s 타임아웃)
     │  • inflight 락으로 SPA 빠른 재트리거 dedup
     │  • history.pushState/replaceState 패치로 SPA nav 감지
     │
     ▼  chrome.runtime.sendMessage (COLLECT_REQUEST + inPageData)
[4] Background service worker
     │  • runCollectJob → 18s watchdog + Promise.race
     │  • cache hit → 바로 반환 (24시간 TTL)
     │  • cache miss → collectFor(inPageData) 사용
     │  • orchestrate → encarToFacts → evaluate
     │  • cache.put
     │
     ▼  broadcast (sendResponse + chrome.runtime.sendMessage)
[5] Side panel React component
     │  • activeRef 로 현재 active carId 추적
     │  • COLLECT_RESULT 브로드캐스트 수신 시 payload 로 바로 setRow
     │  • DB 왕복 제로 — race condition 없음
```

### 4.2 Fallback 경로 (Side Panel 직접 트리거)

콘텐츠 스크립트가 주입되지 않은 탭에서 사용자가 사이드패널만 연 경우:

```
Side panel → COLLECT_FOR_TAB → Background
  → chrome.scripting.executeScript({ world: 'MAIN', func: mainWorldCollect })
  → 같은 주 경로 [4] 로 합류
```

### 4.3 타임아웃 계층 (무한 로딩 방지)

| 레벨 | 타임아웃 | 목적 |
|---|---|---|
| MAIN world 각 fetch | 7초 | 개별 엔드포인트 장애 격리 |
| Isolated → MAIN world postMessage | 15초 | main-world 지연 대응 |
| Background watchdog | 18초 | collectFor 전체 |
| Side panel hard timeout | 22초 | UI 반드시 회복 |

어느 경로도 22초 이상 "평가 중..." 에서 멈추지 않는다.

### 4.4 CORS & 인증 핵심 주의사항

**⚠️ `fetch(url, { credentials: 'include' })` 사용 금지** (api.encar.com 한정).

- `credentials: 'include'` → CORS preflight OPTIONS → **api.encar.com 이 거부** → `TypeError: Failed to fetch`
- 기본 `fetch(url)` → preflight 없음 + api.encar.com 이 fem.encar.com 과 **same-site** 이므로 first-party 쿠키 자동 포함 → ✅

이 한 가지 gotcha 때문에 API 피벗이 "수집 안 됨" 으로 완전히 실패했던 적이 있다. 향후 수정자도 이 옵션을 다시 추가하면 안 된다.

---

## Section 5 — 룰 엔진

### 5.1 11 룰 정의

| ID | 제목 | 입력 소스 | 종류 | 판정 |
|---|---|---|---|---|
| R01 | 보험이력 공개 | detailFlags.isInsuranceExist | 정보 공개 | true=pass / false=fail |
| R02 | 성능점검 공개 | detailFlags.isHistoryView | 정보 공개 | true=pass / false=fail |
| R03 | 엔카진단 통과 | detailFlags.isDiagnosisExist | **KILLER** | true=pass / false=killer |
| R04 | 프레임 무사고 | diagnosisApi CHECKER_COMMENT → fallback hasEncarDiagnosis | **KILLER** | false=pass / true=killer |
| R05 | 렌트/택시/영업 없음 | record.loan/business/government | **KILLER** | all=0 → pass |
| R06 | 전손/침수/도난 없음 | record.totalLoss/flood/robber | **KILLER** | sum=0 → pass |
| R07 | 1인 신조 | record.ownerChangeCnt | 가산 | ≤1 → pass / >1 → warn |
| R08 | 자차보험 공백 없음 | record.notJoinDate1..5 | **KILLER** | all null → pass |
| R09 | 수리비 미확정 없음 | record 가 있으면 항상 pass | 가산 | API 는 전부 확정 금액만 반환 |
| R10 | 자잘한 사고 처리 | record.myAccidentCost / otherAccidentCost | 가산 | max < 임계 → pass (국산 100만 / 외제 200만) |
| R11 | 가격 적정성 | base.advertisement.price / category.newPrice | 가산 | 0.5~1.0 → pass |

### 5.2 Verdict 산출

```
killer > 0                    → NEVER
warn > 0                       → CAUTION
any unknown, no warn           → UNKNOWN
otherwise                      → OK
```

Score (0~100): pass=10, warn=4, fail/killer=0, unknown=5, 합계/max * 100.

### 5.3 불변식 (Bridge)

- **F1**: 법인 ≠ 렌트. R05 는 `record.loan/business/government` 만 사용. `release.flag === 'CORPORATION'` 같은 힌트는 무시. *Sample 004 (BMW E90) 이 corporate 이지만 `loan=0` 이라 R05 PASS — 회귀 테스트가 있음.*
- **F2**: 사고 금액은 `record.myAccidentCost` / `otherAccidentCost` 정수 사용. HTML insurance entry heuristic 파싱 금지.
- **F3**: 날짜 필드는 string 그대로 통과. `3000년 01월 16일` 같은 비정상값 관측 이력이 있으므로 strict parse 안 함.
- **F4**: `login_required` reason 감지 시 해당 facts 는 `parse_failed('login_required')` 로 세팅. UI 에서 "🔒 로그인 필요" 로 노출.

### 5.4 Coverage Matrix v2

| 룰 | 필요 소스 | 로그인 | MVP 신뢰도 |
|---|---|---|---|
| R01 | detailFlags | ❌ | 🟢 |
| R02 | detailFlags | ❌ | 🟢 |
| R03 | detailFlags | ❌ | 🟢 |
| R04 | diagnosisApi (+ R03 fallback) | ❌ | 🟢 |
| R05 | recordApi | ❌ | 🟢 |
| R06 | recordApi | ❌ | 🟢 |
| R07 | recordApi | ❌ | 🟢 |
| R08 | recordApi | ❌ | 🟢 |
| R09 | recordApi | ❌ | 🟡 (API 는 미확정 개념 없음) |
| R10 | recordApi + base.domestic | ❌ | 🟢 |
| R11 | base | ❌ | 🟡 (시세 API 미연동) |

**모든 11 룰이 로그인 없이 동작** — Phase 0 Discovery 에서 예상했던 "R05~R09 는 로그인 필요" 제약이 API 덕분에 사라졌다.

---

## Section 6 — UI/UX

### 6.1 디스플레이 모드: Side Panel 단일

- **Floating Chip 삭제** — side panel 이 항상 열려있는 UX 로 단순화. (Phase 2 복구 가능.)
- **Tab 삭제** — 단일 스크롤 + 필터 칩 으로 압축.

### 6.2 Verdict Hero

```
┌──────────────────────────────────────┐
│ 🚨 피해야 할 매물 · 심각한 위험 신호   │
│                          ┌──────┐    │
│ 기아 스포티지 5세대      │  32  │    │
│ 디젤 2.0 · 2021년 11월·  │ /100 │    │
│ 109,217km · 2,100만원    └──────┘    │
│ #41623743                            │
│                                      │
│ 🔴 심각 2 · 🟡 주의 1 · 🟢 통과 5    │
│                       [↻ 재평가]     │
└──────────────────────────────────────┘
```

- 그라디언트 배경 (verdict 별 색)
- 원형 스코어 링 SVG
- 매물 타이틀: `제조사 + 모델` 굵게, sub: `등급 · 연월 · 주행거리 · 가격`
- mini stats: 심각/주의/통과/불명 개수
- 우상단 재평가 버튼

### 6.3 필터 칩
```
[전체 11]  [위험 3]  [통과 5]  [불명 3]
```
현재 필터에 맞는 룰만 렌더.

### 6.4 카테고리 그룹

CATEGORY_ORDER: `차량 상태 → 이력 → 사고 → 가격 → 투명성`

각 카테고리 내 룰 카드:
```
🛠 프레임 무사고            [통과]
   프레임에 사고 흔적이 없습니다
```

아이콘 매핑은 `src/sidepanel/rule-meta.ts` 의 `RULE_META` 에서만 관리 — core 에는 영향 없음.

### 6.5 로딩 & 에러 상태
- 스피너 + "평가 중..." + stage 라벨 (`수집 준비 → 이력·진단·사고 리포트 수집 중`)
- 22초 무응답 → "🕐 응답이 늦어지고 있어요" + "↻ 다시 시도"
- `watchdog_timeout` / `main_world_script_failed` 등 → "⚠ 수집에 실패했어요" + 이유 한글화

### 6.6 Ack 흐름
1. Killer 룰 카드 하단 "이 경고 인정 (7일)" 버튼
2. 확인 다이얼로그
3. Dexie `acks` 테이블 insert
4. 다음 평가 시 해당 룰은 verdict 계산에서 제외, UI 에 "사용자가 무시함" 배지

---

## Section 7 — 스토리지 & 메시징

### 7.1 Dexie schema

```typescript
class DaksinDB extends Dexie {
  cache    !: Table<CacheRow, string>;    // carId → 평가 결과 (24h TTL)
  acks     !: Table<AckRow, [string, string]>;  // [carId, ruleId] → 7d TTL
  saved    !: Table<SavedRow, string>;    // 저장된 매물 (∞)
  settings !: Table<SettingRow, string>;  // 키-값 (∞)
}
```

`sweepExpired()` 를 `chrome.alarms` 로 24시간마다 호출해 만료 행 제거.

### 7.2 Message Protocol

```typescript
type Message =
  | { type: 'COLLECT_REQUEST';  carId; url; inPageData }   // content → bg
  | { type: 'COLLECT_FOR_TAB';  carId; url; tabId }        // sidepanel → bg
  | { type: 'COLLECT_PROGRESS'; carId; stage }             // bg → *
  | { type: 'COLLECT_RESULT';   carId; parsed; facts; report }  // bg → *
  | { type: 'COLLECT_ERROR';    carId; reason }            // bg → *
  | { type: 'ACK_RULE';         carId; ruleId }            // sidepanel → bg
  | { type: 'REFRESH';          carId }                    // sidepanel → bg + content
  | { type: 'GET_LAST';         carId? };                  // sidepanel → bg
```

**Shared handler** `runCollectJob()` 로 COLLECT_REQUEST / COLLECT_FOR_TAB 의 watchdog + broadcast 로직 통합.

---

## Section 8 — 에러 처리 / 상태 머신

### 8.1 로그인 상태
MVP 에서는 불필요 — record API 가 `openData=true` 필드 덕에 로그인 없이도 핵심 데이터를 반환.

### 8.2 데이터 결손 시나리오

| 상황 | 감지 | 처리 |
|---|---|---|
| `__PRELOADED_STATE__` 없음 | state.ts → `__NEXT_DATA__` fallback | 둘 다 없으면 `parse_failed('preloaded_state_missing')` |
| api.encar.com 500/네트워크 오류 | main-world 7초 timeout | 해당 JSON 필드 null → `parse_failed('record_api_empty')` 등 |
| vehicleId 필드 누락 | base 파싱 후 체크 | API fetch 스킵, record/diagnosis/inspection 전부 `parse_failed('not_fetched')` |
| 비정상 날짜 (3000년) | string 그대로 통과 | UI 에서 raw 값만 표시, 정렬/계산 안 씀 |
| CORS `credentials:include` 버그 | N/A (삭제됨) | 과거 회귀 방지 |

### 8.3 여러 탭 동시 평가
- Background 는 각 COLLECT_REQUEST 에 대해 독립 Promise 로 처리
- Side panel 은 `activeRef` 로 **현재 active carId 와 일치하는 broadcast 만 수용**
- 다른 탭의 결과가 도착해도 현재 탭 UI 를 오염시키지 않음

### 8.4 SPA 네비게이션
- `history.pushState/replaceState` 를 isolated script 에서 **patch** → `daksin:urlchange` 이벤트
- 각 URL 변경마다 `collect(force=true)` → 새 carId 로 즉시 평가 시작
- Side panel 의 `chrome.tabs.onUpdated` 도 병행 감지

---

## Section 9 — 테스팅 전략

### 9.1 테스트 계층

| 계층 | 파일 | 개수 | 대상 |
|---|---|---|---|
| 유틸 | tests/parsers.test.ts | 2 | wonToNumber, splitLines |
| 파서 단위 | tests/parsers.test.ts | 12 | state.ts, api-record.ts, api-diagnosis.ts, api-inspection.ts |
| 오케스트레이터 | tests/orchestrate.test.ts | 2 | state + API JSON → ParsedData 조합 |
| 통합 (fixture) | tests/integration.test.ts | 5 | parsed → facts → verdict 종단 |

**총 21 테스트**, Vitest + happy-dom 불필요 (파서가 DOM 의존 없음).

### 9.2 Fixture 기반 회귀

`src/__fixtures__/samples.ts` 에 4 실 샘플 + 1 synthetic ideal 고정:

| 샘플 | 차량 | 예상 verdict | 핵심 검증 |
|---|---|---|---|
| 001 | 기아 스포티지 5세대 | NEVER (R05, R08) | loan>0 + notJoinDate1 |
| 002 | 현대 팰리세이드 | NEVER (R03, R05, R08) | isDiagnosisExist=false |
| 003 | 현대 팰리세이드 2.2 | NEVER (R03, R05, R08) + R10 WARN | otherAccidentCost > 100만 |
| 004 | BMW E90 328i | NEVER (R08) + R10 WARN | **F1 불변식 — 법인 ≠ 렌트** |
| ideal | 합성 아반떼 2024 | OK | 전체 클린 |

Verdict 불일치 발생 시 즉시 회귀로 잡힘.

### 9.3 커버리지 목표
- core/rules = 100% (순수 함수, 필수)
- core/bridge ≥ 90%
- core/parsers ≥ 85%
- background/sidepanel 는 MV3 수동 테스트 (Phase 2 Playwright)

---

## Section 10 — 의사결정 로그

| # | 결정 | 옵션 | 채택 | 이유 |
|---|---|---|---|---|
| 1 | 데이터 수집 방식 | A) DOM 파싱 / B) LLM vision / C) 외부 API | **A + JSON API** | 결정론 + 재현성 + 법적 안전 |
| 2 | 비공개 vs 파싱실패 구분 | 회색만 / 빨강만 / 둘 분리 | **분리** | 사용자가 다른 의사결정 |
| 3 | 킬러 룰 정책 | 소프트 경고 / 하드 비토 / 비토+ack | **비토+ack 7일** | 안전 기본값 + 사용자 주권 |
| 4 | 저장소 | localStorage / IndexedDB / 백엔드 | **IndexedDB (Dexie)** | 용량 + 프라이버시 |
| 5 | UI 모드 | sidepanel / overlay / popup / hybrid | **side panel 단일** | 단순화, hybrid 는 Phase 2 |
| 6 | 1차 사이트 | Encar only / KCar 병행 | **Encar only** | MVP 집중 |
| 7 | 4-Layer 분리 | 단일 모델 / 4-Layer | **4-Layer** | 사이트 변경 격리 |
| 8 | AI 사용 | 허용 / 금지 | **금지** | 결정론 + 사용자 신뢰 |
| 9 | HTML 스크래핑 | 엔카 report 페이지 HTML 파싱 / API | **API only** | report 페이지가 CSR shell 이라 HTML 쓸모 없음 |
| 10 | CORS 처리 | credentials:include / omit | **omit** | api.encar.com preflight 거부 → Playwright 실측으로 발견 |
| 11 | Content script world | isolated only / MAIN + isolated | **MAIN + isolated** | __PRELOADED_STATE__ + api.encar.com fetch 둘 다 page context 필요 |
| 12 | Side panel broadcast 처리 | DB roundtrip / 직접 payload | **직접 payload** | race condition 제거 |

---

## Section 11 — 리스크 & 미해결

### 11.1 기술 리스크
- **엔카 API 변경**: `api.encar.com/v1/readside/*` 는 비공식. 엔카가 경로/스키마를 바꾸면 파서 복구 필요. 핵심 필드에 스모크 테스트 존재.
- **API rate limiting**: 동시 많은 탭 평가 시 api.encar.com 이 차단할 가능성. 현재 caching 이 기본 방어.
- **@crxjs/vite-plugin 2 beta**: 빌드 성공 + 런타임 검증 완료 (사용자 실테스트 OK).
- **CORS credentials**: `credentials:'include'` 는 다시 추가하면 전부 깨짐. commit directive + 주석으로 lock.

### 11.2 제품 리스크
- **시세 비교 미연동**: R11 은 newPrice 대비 단순 비율만. 실시세 API 필요.
- **긍정 샘플 부재**: 모든 실 샘플이 NEVER. 합성 ideal 로만 OK 경로 검증.

### 11.3 Phase 2 백로그
1. Floating chip in-page 주입 (hybrid UX 복구)
2. Export/Import JSON 백업 UI
3. R12 리콜 / R13 노후·고주행 (가산 룰)
4. R11 외부 시세 API
5. KCar/KB차차차 등 멀티 사이트 (bridge 추가만)
6. E2E Playwright smoke
7. 사용자 설정 (임계값 조정, 룰 on/off)

---

## Section 12 — 글로서리

- **닥신 / 닥터신**: 한국 중고차 평가 유튜버. 11 룰 체크리스트 출처.
- **자차보험 공백**: 차량 등록 후 자차보험 미가입 기간. API 필드 `notJoinDate1..5`.
- **킬러 룰 (Killer Rule)**: 위반 시 verdict 를 NEVER 로 고정시키는 룰. 사용자 ack 로만 우회.
- **FieldStatus**: 파싱 결과의 5상태 ADT (value/hidden/parse_failed/loading/timeout).
- **Bridge**: Layer A → Layer B 변환 함수. 불변식의 본거지.
- **vehicleId**: Encar 내부 차량 ID. 리스팅 URL 의 dummy ID 와 다를 수 있음 — 반드시 `__PRELOADED_STATE__.cars.base.vehicleId` 에서 읽어야 함.
- **record API**: `api.encar.com/v1/readside/record/vehicle/{vid}/open?vehicleNo={no}` — R05~R10 원천.
- **Main world / Isolated world**: Chrome 익스텐션의 두 JS 실행 컨텍스트. MAIN 은 페이지와 같은 컨텍스트 (window.__PRELOADED_STATE__, fetch 쿠키 공유), ISOLATED 는 익스텐션 전용 (chrome.runtime API 가능).

---

## 부록 A — 파일 구조

```
daksin-car/
├─ docs/
│  ├─ design/
│  │  ├─ DESIGN.md           ← 이 문서
│  │  └─ SPEC_REVIEW.md
│  ├─ discovery/encar/
│  │  ├─ README.md           통합 디스커버리
│  │  └─ samples/001~004.md  4 실 매물 상세
│  └─ plan/
│     ├─ IMPLEMENTATION.md
│     ├─ REVIEW.md           계획 리뷰
│     └─ CODE_REVIEW.md      코드 리뷰
├─ src/
│  ├─ core/                  (pure domain, DOM 없음)
│  ├─ background/
│  ├─ content/fem-encar/
│  ├─ sidepanel/
│  ├─ manifest.ts
│  └─ __fixtures__/
├─ tests/                    Vitest
├─ package.json              Vite+CRXJS+React18+Dexie4+Zod4+Vitest2
├─ tsconfig.json             strict + noUncheckedIndexedAccess
├─ vite.config.ts
└─ vitest.config.ts
```

## 부록 B — 빌드 & 배포

```bash
npm install
npx tsc --noEmit     # 타입 체크
npx vitest run       # 21/21 통과
npm run build        # dist/ 생성

# Chrome 로드:
# chrome://extensions → 개발자 모드 → 압축해제된 확장프로그램 로드 → dist/
```

빌드 결과:
```
dist/manifest.json                       1.28 kB
dist/service-worker-loader.js            0.04 kB
dist/src/sidepanel/index.html            0.55 kB
dist/assets/main-world.ts-*.js           1.83 kB  (MAIN world content script)
dist/assets/index.ts-*.js (isolated)     1.95 kB  (ISOLATED content script)
dist/assets/index.ts-*.js (background) 111.16 kB  (service worker)
dist/assets/sidepanel-*.js             155.22 kB  (React + App)
```

## 부록 C — 핵심 Git History

```
a020845 test: parser unit tests + bridge integration fixtures
87fbf7b feat(extension): MV3 shell — background, content scripts, side panel
2c399e6 feat(core): 4-layer domain model + Encar API parsers + rule engine
7d98743 docs: discovery + design + plan documentation
f6adf0c chore: bootstrap project tooling
```

각 commit 의 trailers 에 `Constraint:` / `Directive:` / `Confidence:` / `Scope-risk:` 등 의사결정 컨텍스트 보존.
