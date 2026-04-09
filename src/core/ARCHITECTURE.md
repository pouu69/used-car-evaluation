# Core Architecture — 크롤러 · 파서 · 브리지 · 규칙 엔진

> **범위:** `src/core/**`, `src/background/**`, `src/content/**`.
> **대상:** 이 레이어를 수정하거나, 새 데이터 소스 / 새 사이트(예: kcar) 를 추가하는 사람.
> **읽는 순서:** 제품 개요는 [README.md](../../README.md), UI 스펙은 [`docs/superpowers/specs/2026-04-09-sidepanel-brutalist-redesign.md`](../../docs/superpowers/specs/2026-04-09-sidepanel-brutalist-redesign.md) 를 먼저.

---

## 1. 왜 이 구조인가

엔카 매물 데이터는 세 가지 특성이 있다:

1. **출처가 파편화** — 페이지 전역 상태(`__PRELOADED_STATE__`), `api.encar.com` 의 별도 엔드포인트 3개(record / diagnosis / inspection), DOM 텍스트, 그리고 레거시 history 페이지. 한 규칙에 필요한 데이터가 여러 출처에 흩어져 있고 어떤 출처는 로그인이 필요하다.
2. **데이터 부재가 1급 시민** — 딜러가 비공개, API 404, 로그인 필요, CORS 실패, 개인매물이라 애초에 해당 엔드포인트가 없음 등 "값이 없는 이유" 가 매우 다양하다. `undefined` 로 퉁치면 "판단 유보" 와 "이력 없음" 이 섞여 오판이 생긴다.
3. **판정 로직이 자주 바뀐다** — 경미사고 임계값, 관용/렌트/택시 처리 강도, 가격 적정성 밴드 등은 운영하면서 계속 튠한다. 파이프라인을 뜯지 않고 규칙만 교체할 수 있어야 한다.

이 세 가지가 아래 4-layer 파이프라인의 설계 근거다.

```
 ┌──────────────────────────────┐  where data lives, how to fetch
 │ Collectors (content+bg)      │   · main-world fetch
 │ src/content/, src/background │   · preloaded_state 추출
 └──────────────┬───────────────┘   · CORS/로그인/404 핸들링
                │ raw JSON / page state + httpStatus
                ▼
 ┌──────────────────────────────┐  site-specific → structured
 │ Parsers (Layer A)            │   · api-record.ts, api-diagnosis.ts,
 │ src/core/parsers/encar/      │     api-inspection.ts, state.ts
 └──────────────┬───────────────┘   · 반환값은 FieldStatus<T>
                │ EncarParsedData
                ▼
 ┌──────────────────────────────┐  site-agnostic facts
 │ Bridge (Layer B→C)           │   · encar-to-facts.ts
 │ src/core/bridge/             │   · 개인/딜러 브랜치, 사고-프레임 계층
 └──────────────┬───────────────┘   · ChecklistFacts 생성
                │ ChecklistFacts
                ▼
 ┌──────────────────────────────┐  pure rules, no I/O
 │ Rules (Layer D)              │   · r01 ~ r11, evaluate()
 │ src/core/rules/              │   · RuleReport 생성
 └──────────────┬───────────────┘
                │ RuleReport {verdict, score, results, killers, warns}
                ▼
            Sidepanel UI
```

**원칙:** 각 레이어는 **바로 아래 레이어의 출력만** 입력으로 받는다. Rules 는 `chrome.*`, `fetch`, `window` 어느 것도 import 하지 않는다. Bridge 는 특정 사이트의 DOM 구조를 모른다. Parsers 는 네트워크를 호출하지 않는다.

---

## 2. 데이터 수집 레이어 (Collectors)

엔카 상세 페이지에서 필요한 것은 4가지다:

| 데이터                          | 위치                                 | 획득 방법                      | 로그인 |
| ------------------------------- | ------------------------------------ | ------------------------------ | ------ |
| `__PRELOADED_STATE__.cars.base` | 페이지 전역 변수                     | `page_state` (main-world)      | X      |
| `__PRELOADED_STATE__.cars.detailFlags` | 페이지 전역 변수              | `page_state` (main-world)      | X      |
| record JSON (R05~R10)           | `api.encar.com/v1/readside/record/vehicle/{id}/open` | `fetch()` in main-world        | X      |
| diagnosis JSON (R03, R04)       | `api.encar.com/v1/readside/diagnosis/vehicle/{id}`    | `fetch()` in main-world        | X      |
| inspection JSON (R02, R04, R06) | `api.encar.com/v1/readside/inspection/vehicle/{id}`   | `fetch()` in main-world        | X      |

### 2.1 왜 main-world 에서 직접 fetch 하는가

`api.encar.com` 는 `fem.encar.com` 의 same-site 쿠키 + 동일 Origin 을 요구한다. 서비스워커(`background/index.ts`)에서 `fetch(url, { credentials: 'include' })` 를 호출하면:

- Origin 이 확장 프로그램 (`chrome-extension://...`) 이 되어 CORS preflight 에서 거절된다.
- `credentials: 'include'` 를 붙여도 CORS 가 막히면 의미가 없다.

해결책: `chrome.scripting.executeScript({ world: 'MAIN', func: mainWorldCollect })` 로 **페이지의 자기 JS 컨텍스트** 에서 `fetch` 를 실행한다. 그러면:

- Origin 은 `https://fem.encar.com` (same-site with `api.encar.com`)
- 페이지가 이미 가진 first-party 쿠키가 자동 동반
- **`credentials: 'include'` 는 오히려 안 붙여야 한다** — main-world 기본 `fetch` 가 이미 쿠키를 보내고, `include` 를 붙이면 preflight 가 발생해서 거절됨 ([`main-world-collector.ts:97`](background/../../background/main-world-collector.ts))

엔카 자체 JS 가 동작하는 방식과 **완전히 동일** 하다. 우회가 아니라 엔카의 정상 호출 경로를 그대로 탄다.

### 2.2 2-채널 수집

main-world 수집기는 **두 가지 경로** 로 동시에 존재한다:

**(a) 콘텐츠 스크립트 경로 — 자동 수집 (주력)**

```
상세 페이지 로드 / SPA 네비게이션
  ↓
content/fem-encar/main-world.ts  (MAIN world 주입)
  ↓ doCollect() 즉시 실행, inflight 공유 promise
  ↓ window.postMessage({source:'autoverdict/main-world', payload})
content/fem-encar/index.ts  (ISOLATED world)
  ↓ chrome.runtime.sendMessage(COLLECT_REQUEST, { inPageData: payload })
background/index.ts
```

- `main-world.ts` 는 페이지 로드 즉시 `void post(null)` 로 **프라이밍** 한다. 사이드패널이 열리기 전에 미리 API 호출을 시작해서 사용자가 패널을 열 때 이미 결과가 거의 준비돼 있게 한다.
- 여러 소비자(자동 브로드캐스트 + isolated 의 `request_state`)가 동시에 호출해도 `inflight` 공유 promise 로 한 번만 실제 fetch 한다.
- SPA 네비게이션 감지를 위해 `history.pushState/replaceState` 를 **monkey-patch** 하고 `autoverdict:urlchange` 이벤트를 발생시킨다. 엔카는 상세 페이지 간 이동을 SPA 로 하므로 `popstate` 만으로는 부족하다.

**(b) 서비스워커 경로 — 사이드패널 직접 트리거**

```
사이드패널 open → useCarData → 'COLLECT_FOR_TAB'
  ↓
background/index.ts → runMainWorldCollect(tabId)
  ↓ chrome.scripting.executeScript({world:'MAIN', func: mainWorldCollect})
```

- `background/main-world-collector.ts` 의 `mainWorldCollect` 는 **stringified 로 주입** 되므로 모듈 스코프 심볼을 참조하면 안 된다 (`ReferenceError` 발생). 파일 상단 주석 참조.
- 콘텐츠 스크립트가 먼저 페이로드를 보냈다면 `opts.inPageData` 가 우선, 그렇지 않으면 이 경로로 fallback.

### 2.3 HTTP 상태 전파

엔카 API 는 **매물 성격에 따라 정상적으로 404 를 반환** 한다.

- **딜러 매물**: 세 엔드포인트 모두 200
- **개인(CLIENT) 매물**: `record` 는 200, `diagnosis`·`inspection` 은 **404 가 정상** — 유료 엔카진단 / 성능점검은 딜러 차량에만 적용되기 때문

그래서 `mainWorldCollect` 는 각 fetch 의 결과를 `FetchStatus` 로 구분한다:

```ts
type FetchStatus =
  | 'ok'           // 2xx + JSON
  | 'not_found'    // 404 — 의도적 부재 (개인매물, 삭제 등)
  | 'unauthorized' // 401/403 — 로그인 필요
  | 'error'        // 5xx / 네트워크 / 파싱 실패
  | 'skipped';     // 애초에 호출 안 함 (vehicleId 없음)
```

이 상태를 `httpStatus: {recordJson, diagnosisJson, inspectionJson}` 로 포장해 orchestrator 까지 운반한다. orchestrator 는 `reasonForStatus()` 로 이걸 `parse_failed` 의 `reason` 문자열로 변환한다:

| FetchStatus      | parse_failed reason         | UI 표기                          |
| ---------------- | --------------------------- | -------------------------------- |
| `not_found`      | `no_report_for_personal`    | "개인매물 — 엔카 리포트 없음"    |
| `unauthorized`   | `login_required`            | "🔒 로그인 필요"                 |
| `error`          | `api_fetch_error`           | "데이터 수집 오류"               |
| `skipped`        | `not_fetched`               | "수집 대기 중"                   |

**이것이 데이터 부재를 1급 시민으로 취급한다는 설계의 실체다.** 규칙 엔진이 "404 는 의도적 부재" 와 "네트워크 실패" 를 다르게 처리할 수 있고, 사용자에게 정확한 이유를 보여줄 수 있다.

### 2.4 타임아웃과 watchdog

세 단계에서 독립적으로 타임아웃이 걸린다:

| 위치                        | 제한       | 해제 시                                |
| --------------------------- | ---------- | -------------------------------------- |
| `main-world.ts` 개별 fetch  | 6.5~7s     | 해당 엔드포인트만 `'error'` 로 마킹    |
| `main-world-collector.ts` 개별 fetch | 6.5s (동일 로직) | 동일                                    |
| `background/index.ts` 전체 collect | 18s (`watchdog_timeout`) | `COLLECT_ERROR` 전파, 캐시 갱신 안 함 |

느린 한 엔드포인트가 다른 엔드포인트를 막지 못한다 (`Promise.all([...tasks])`). 전체 watchdog 가 있어 사이드패널이 영원히 로딩에 갇히지 않는다.

---

## 3. Parsers (Layer A)

**입력:** raw JSON / page state. **출력:** `FieldStatus<T>` 로 래핑된 typed 구조체.

### 3.1 파일 구성

| 파일                  | 파싱 대상                                         | 주요 export                                   |
| --------------------- | ------------------------------------------------- | --------------------------------------------- |
| `state.ts`            | `window.__PRELOADED_STATE__.cars.{base,detailFlags}` | `extractBase`, `extractDetailFlags`       |
| `api-record.ts`       | `api.encar.com/.../record/...`                    | `parseRecordApi`, `getInsuranceGapPeriods`    |
| `api-diagnosis.ts`    | `api.encar.com/.../diagnosis/...`                 | `parseDiagnosisApi`, `getFrameIntact`         |
| `api-inspection.ts`   | `api.encar.com/.../inspection/...`                | `parseInspectionApi`, `getFrameFromInspection`|
| `index.ts`            | `orchestrate()` — 위 4개를 묶어 `EncarParsedData` 생성 |                                          |

### 3.2 설계 규칙

- **파서는 `FieldStatus<T>` 만 반환** — 성공 시 `value(x)`, 실패 시 `failed('reason_key')`. 절대 throw 하지 않는다.
- **스키마 드리프트 감지** — `parseRecordApi` 는 필수 필드(`myAccidentCnt`, `otherAccidentCnt`, `ownerChangeCnt`) 를 체크해 누락 시 `record_api_missing_{key}` 로 내려준다. 엔카가 API 스키마를 바꾸면 조용히 잘못된 결과를 내는 대신 명시적으로 실패한다.
- **API 오타도 그대로 받는다** — `InspectionApi.master.accdient` (sic). API 응답 그대로. 우리가 고칠 문제가 아니고 고치면 다음 응답에서 깨진다.
- **`deepFind` fallback** — `state.ts` 는 `__PRELOADED_STATE__` 가 없을 때 `__NEXT_DATA__` 에서 `base`/`detailFlags` 키를 재귀 탐색한다. 엔카가 Next.js 로 이전할 경우를 대비한 안전장치.
- **파생 헬퍼는 파서 파일 안에** — `getInsuranceGapPeriods`(R08), `getFrameIntact`(R04), `getFrameFromInspection`(R04) 은 각 API 의 raw 필드를 bridge 가 바로 쓸 수 있는 형태로 변환한다. 순수 함수라 단위 테스트하기 좋다.

### 3.3 `orchestrate()`

```
inputs (url, carId, preloadedRoot, recordJson, diagnosisJson, inspectionJson, httpStatus)
  ↓
extractBase + extractDetailFlags            ← preloadedRoot
resolveApi(recordJson, httpStatus.recordJson, parseRecordApi)
resolveApi(diagnosisJson, httpStatus.diagnosisJson, parseDiagnosisApi)
resolveApi(inspectionJson, httpStatus.inspectionJson, parseInspectionApi)
  ↓
EncarParsedData { raw: { base, detailFlags, recordApi, diagnosisApi, inspectionApi } }
```

`resolveApi` 가 핵심 결합 지점이다: `httpStatus` 가 `'ok'` 도 `'skipped'` 도 아니면 (= 명시적 실패) 파서를 돌리지 않고 바로 `failed(reason)` 로 내려서 원인 정보를 보존한다.

---

## 4. Bridge (`encar-to-facts.ts`) — Layer B/C

`EncarParsedData` → `ChecklistFacts`. **이 파일이 제품의 도메인 지식이 가장 많이 응축된 곳이다.** 여기서 결정하는 불변식 세 가지가 전체 제품의 판정 품질을 좌우한다.

### 4.1 불변식

**F1. 법인 ≠ 렌트.** R05 (렌트/택시/영업) 는 `record.loan`(렌트) / `record.business`(택시) / `record.government`(관용) 로 분리된다. "법인 소유" 였다는 이유만으로 killer 를 때리면 오판이 너무 많다 — 대기업 업무차는 관리이력이 오히려 양호하다. 그래서:

- `loan > 0` → `rental: true` → **killer**
- `business > 0` → `taxi: true` → **killer**
- `government > 0` → `business: true` (여기서는 관용을 의미) → **warn** (killer 아님)

룰 엔진 `r05` 에서 이 분기가 구현되어 있다.

**F2. 사고 금액은 구조화된 정수에서만.** R10 (보험처리 규모) 는 `record.myAccidentCost` / `record.otherAccidentCost` 원 단위 정수에서 직접 읽는다. 과거에 보험이력 HTML 에서 금액을 긁어오던 파서는 전부 제거됐다. 휴리스틱 스크레이핑은 "300만원" / "300,000원" 같은 단위 혼동을 100% 막을 수 없다.

**F3. 딜러 vs 개인은 속성이 아니라 분기다.** 개인(CLIENT) 매물은:

- 엔카의 유료 진단(R03) 을 애초에 살 수 없다
- 성능점검(R02) 도 법적으로 의무가 아니다
- `diagnosis` / `inspection` API 가 404 를 리턴한다

그래서 "진단 없음 = killer" 로 처리하면 모든 개인매물이 NEVER 가 된다. `isPersonalListing()` 가 이 분기의 유일한 판단 지점이다:

```
(detailFlags.isDealer === false) OR (base.contact.userType === 'CLIENT')
```

개인매물인 경우 `hasEncarDiagnosis` 는 `failed('not_applicable_personal')` 로 세팅 → 룰 엔진이 severity=`unknown` 으로 처리 → UI 에서 "개인매물 — 해당없음" 으로 표시. **버그가 아니라 정답이다.**

**두 플래그를 둘 다 체크하는 이유:** 과거 API 응답에는 `isDealer` 가 없었고, 새 fixture 에는 `userType` 이 없다. 한쪽만 믿으면 sample 006 에서 회귀한다.

### 4.2 R04 프레임 손상 — 3-layer 소스 계층

R04 만 특수하게 다중 소스 계층을 쓴다. 신뢰도 순서:

```
1. diagnosisApi.items[CHECKER_COMMENT]  ← 엔카 유료 진단의 종합 판정 (딜러만)
2. inspectionApi.master.accdient         ← 법정 성능점검 리포트
3. detailFlags.isDiagnosisExist === true ← 엔카진단 뱃지 휴리스틱
```

1-2-3 순으로 시도하고 첫 성공에서 멈춘다. 각 시도가 모두 실패하면 `frameDamage` 는 `failed('not_derived')` 상태로 남아 UI 는 `unknown` 을 표시한다.

**sample 007 가 이 계층 설계의 기준점이다**: 딜러지만 엔카진단 뱃지가 없고, 성능점검 리포트에 `master.accdient === false` 가 있다. 예전에는 R04 가 UNKNOWN 이었는데 이제 PASS 로 판정된다. 회귀 방지를 위해 테스트 fixture 로 고정돼 있다.

**주의:** `master.simpleRepair === true` 는 **프레임 손상을 의미하지 않는다**. 외판 볼트 결합부(문/펜더/본넷/트렁크) 교체를 말하는 것이고 엔카 데이터 모델에서는 프레임 용접과 별개다. sample 007 이 `accdient=false && simpleRepair=true` 로 R04 PASS 인 것이 기준.

### 4.3 R08 자차보험 공백 — `YYYY-MM` 양끝 포함 계산

`notJoinDate1..5` 는 `"202508~202512"` 형식의 **포함(inclusive)** 기간이다. `monthsBetweenInclusive('2025-08', '2025-12')` = 5 (Aug, Sep, Oct, Nov, Dec). 배타 계산하면 4달로 찍혀서 "4개월" vs "5개월" 차이가 UI 에 그대로 노출된다. 단위 테스트로 고정되어 있다.

### 4.4 Bridge warnings

`facts.bridgeWarnings: string[]` 는 다음을 기록한다:

- `personal_listing` — 개인매물 브랜치 진입
- `r03_skipped_personal` — R03 을 스킵한 이유 명시
- `frameDamage_from_inspection` / `..._simpleRepair` / `..._from_ribbon` — R04 가 어느 fallback 에서 결정됐는지
- `merge_conflict:{a}≠{b}` — multi-source merge 에서 값이 충돌한 경우 (현재는 사용 안 함, 7.1 참조)

이 warnings 는 디버깅·회귀 추적에 쓴다. UI 에는 노출되지 않는다.

---

## 5. Rules (Layer D)

**입력:** `ChecklistFacts`. **출력:** `RuleReport`. 순수 함수만.

### 5.1 룰 함수 시그니처

```ts
type Rule = (facts: ChecklistFacts) => RuleResult | null;
```

- `null` 반환 = "이 매물에는 해당 없음, UI 에서 숨김". R03(엔카진단 보너스), R11(가격 — `ratio === 0` 일 때) 에서 사용. R03 을 `unknown` 으로 표시하면 개인매물마다 unknown 이 뜨는데, "있으면 +, 없으면 무" 성격이므로 아예 드랍하는 게 맞다.
- 성공 시 `{ruleId, title, severity, message, evidence, acknowledgeable}` 반환.
- `severity`: `pass` | `warn` | `fail` | `killer` | `unknown`
- `acknowledgeable`: killer 이면서 사용자가 "알고 삼" 이라고 명시적으로 덮을 수 있으면 `true`. 현재는 R04 / R05 / R06 만 해당.

### 5.2 severity 별 점수 & verdict

```
SEVERITY_SCORE = { pass: 10, warn: 4, fail: 0, killer: 0, unknown: 5 }
```

```
score = round( sum(SEVERITY_SCORE[r.severity]) / (results.length * 10) * 100 )

verdict =
  killer 하나라도   → 'NEVER'
  warn 하나라도    → 'CAUTION'
  unknown 하나라도 → 'UNKNOWN'
  else             → 'OK'
```

**unknown 점수 5점의 의도:** 데이터가 없을 때 0점을 주면 로그인 안 한 사용자에게 점수가 폭락하고, 10점을 주면 "딜러가 숨긴 것" 과 "다 통과한 것" 이 구분 안 된다. 중간값 5점 + UNKNOWN verdict 로 "판단 유보" 를 명시한다.

### 5.3 왜 `null` 과 `unknown` 을 다르게 쓰는가

| 상황                              | 반환          | 이유                                             |
| --------------------------------- | ------------- | ------------------------------------------------ |
| 데이터 수집 실패 (R08 등)         | `unknown`     | 원래는 평가돼야 하는데 수집 실패 — 사용자에게 알려야 함 |
| 보너스 룰인데 해당 없음 (R03, R11)| `null`        | 애초에 "감점" 성격이 아님 — UI 에서 숨김         |
| 개인매물이라 적용 불가 (R03)      | `unknown`     | "해당없음" 메시지로 명시적 표기                  |

R03 이 경우에 따라 `null` 과 `unknown` 둘 다 쓸 수 있다는 점에 주의: 딜러인데 뱃지 없으면 `null` (숨김), 개인매물이면 `unknown` ("개인매물 — 해당없음" 표기).

### 5.4 새 룰 추가 체크리스트

1. `ChecklistFacts` 에 필요한 필드 추가 (`FieldStatus<T>` 로)
2. 해당 필드를 채울 파서/bridge 로직 추가
3. `rules/index.ts` 에 `rXX: Rule` 구현
4. `ALL_RULES` 배열에 추가
5. `sidepanel/rule-meta.ts` 에 `{category, shortTitle}` 등록
6. fixture 를 `src/__fixtures__/samples.ts` 에 추가, `tests/rules-*.test.ts` 에 회귀 테스트
7. 새 카테고리면 `sidepanel/rule-meta.ts` 의 `CATEGORY_ORDER` 확인 (HealthRadar 축 변경)

---

## 6. Storage & Messaging

### 6.1 Dexie 캐시 (`core/storage/db.ts`)

- **cache** — `{carId, url, parsed, facts, report, cachedAt, expiresAt}`
- **acks** — `{carId, ruleId, ackedAt, expiresAt}` (killer 룰 7일 무시)
- TTL: `CACHE_TTL_MS` (기본값 파일 참조)
- 매일 1회 `chrome.alarms` 로 `sweepExpired()` 호출

**중요한 미묘함:** `GET_LAST` 와 `collectFor` 캐시 히트 모두, **저장된 `facts` / `report` 를 무시하고 `parsed` 에서 매번 재계산** 한다. 이유:

> 규칙 엔진은 계속 바뀐다. 캐시에 남은 구버전 `RuleReport` 를 그대로 돌려주면 코드 업데이트가 화면에 반영되지 않아서 디버깅이 지옥이 된다. `parsed` (원본 파싱 결과) 만 신뢰하고 `encarToFacts` → `evaluate` 를 재실행한다.

확장 reload 만 하면 즉시 새 룰이 기존 캐시에도 적용된다.

### 6.2 메시지 프로토콜 (`core/messaging/protocol.ts`)

모든 배경 ↔ 콘텐츠 ↔ 사이드패널 통신은 discriminated union `Message` 타입 하나로 통일돼 있다. 런타임 타입 가드 `isMessage()` 로 검증한다.

주요 타입:

| Type                | 방향                      | 용도                                          |
| ------------------- | ------------------------- | --------------------------------------------- |
| `COLLECT_REQUEST`   | content → background      | 콘텐츠 스크립트가 페이지 페이로드 전달        |
| `COLLECT_FOR_TAB`   | sidepanel → background    | 사이드패널이 특정 탭 수집 요청                |
| `COLLECT_PROGRESS`  | background → *            | 진행 단계 브로드캐스트                        |
| `COLLECT_RESULT`    | background → *            | 최종 결과 + `RuleReport`                      |
| `COLLECT_ERROR`     | background → *            | 실패 + `reason`                               |
| `GET_LAST`          | sidepanel → background    | 최근 캐시 조회 (facts/report 재계산)          |
| `REFRESH`           | sidepanel → *             | 캐시 삭제 + 재수집 트리거                     |
| `ACK_RULE`          | sidepanel → background    | killer 룰 7일 무시 등록                       |

---

## 7. 확장 포인트

### 7.1 Multi-source merge (`core/collectors/`)

현재 bridge 는 필드당 **한 소스** 만 본다 (R01~R03 ← detailFlags, R05~R10 ← recordApi, R04 는 3-layer 계층). 하지만 cross-validation 기반의 필드가 늘어날 것을 대비해 **merge primitive 는 이미 작성돼 있다**:

- `core/collectors/sources.ts` — `SourceId` 등록, 우선순위 테이블
- `core/collectors/merge.ts` — `mergeFieldStatus()` — 같은 필드를 여러 소스가 보고할 때 (a) 최고 우선순위 성공 선택 (b) 값 불일치 시 `merge_conflict:{a}≠{b}` 경고 (c) 모든 소스 실패 시 종합 reason 생성.

**사용 예시 (미래):** R06 전손/침수를 `recordApi.floodTotalLossCnt` 와 `inspectionApi.master.detail.waterlog` 에서 각각 읽고, 둘 중 하나라도 true 면 killer — cross-validation 이 merge 의 첫 실사용 대상이다.

**`SourceId` 는 영구 ID 다** — 한번 추가한 값은 이름을 바꾸지 마라. IndexedDB 캐시와 `bridgeWarnings` 문자열에 직렬화돼 남는다.

### 7.2 새 사이트 지원 (예: kcar)

1. `src/content/fem-kcar/` 에 콘텐츠 스크립트 작성 (엔카의 `main-world.ts` / `index.ts` 구조 복제)
2. `src/core/parsers/kcar/` 에 `parseXxxApi`, `state.ts` 작성 — 전부 `FieldStatus<T>` 반환
3. `src/core/types/ParsedData.ts` 에 `KcarParsedData` 추가 (또는 generic `ParsedData` 로 리팩터)
4. `src/core/bridge/kcar-to-facts.ts` 작성 — 동일한 `ChecklistFacts` 로 귀결
5. `ChecklistFacts.derivedFrom` 에 `'kcar'` 리터럴 추가
6. **규칙 엔진은 건드리지 않는다.** `rules/index.ts` 는 `ChecklistFacts` 만 본다.

사이트를 추가해도 사이드패널 UI / 룰 / 저장소는 0줄 변경이다. 4-layer 구조의 핵심 이득.

### 7.3 다른 출처에서 같은 필드 읽기

- 새 `SourceId` 추가 → `SOURCE_REGISTRY` 에 등록
- 해당 출처 파서 작성
- Bridge 에서 `mergeFieldStatusMap({preloaded_state: ..., inspection_api: ...})` 로 병합
- 우선순위는 `SOURCE_REGISTRY[id].priority` 로 조정 (manual=1000 > preloaded=100 > api=95 > ...)

---

## 8. 흔한 함정과 설계 결정 기록

| 함정 | 올바른 접근 |
|---|---|
| `credentials: 'include'` 를 main-world fetch 에 추가 | **붙이지 말 것.** CORS preflight 발생 → 거절. 기본 fetch 가 이미 쿠키 전송. |
| `background` 에서 `fetch('https://api.encar.com/...')` | CORS 로 거절. `chrome.scripting.executeScript({world:'MAIN'})` 경유. |
| 서비스워커에서 `main-world-collector.ts` 의 상위 스코프 심볼 import | `mainWorldCollect` 는 stringified 로 주입되므로 모듈 스코프 심볼 참조 시 `ReferenceError`. 함수 내부 self-contained. |
| 캐시에서 `report` 를 그대로 반환 | **재계산해라.** 규칙 로직 업데이트가 캐시로 인해 무효화된다. |
| 개인매물 R03 을 fail 로 | **`not_applicable_personal`.** 유료 진단을 살 수 없으니 killer 가 아님. |
| API 응답의 `accdient` 오타 수정 | 건들지 마라 — 엔카 그대로. 고치면 다음 응답에서 깨짐. |
| `master.simpleRepair === true` 를 프레임 손상으로 | **아님.** 외판 교체. R04 는 `master.accdient` 만 본다. sample 007 이 기준. |
| R05 에서 관용(government) 을 killer 처리 | **warn 으로 완화.** 법인 ≠ 렌트, F1 불변식. |
| R08 공백 개월수를 양끝 배타 계산 | **inclusive.** `monthsBetweenInclusive` 기준. |
| R10 경미사고 기준값을 하드코딩 | `domestic ? 200만 : 400만` 을 rules/index.ts 내부에 두되, 밴드 문자열을 UI 에 노출. 기준값 튠 시 이 한 곳만 수정. |
| `preloaded_state` 가 없을 때 즉시 에러 | `__NEXT_DATA__` 에서 `deepFind` fallback. 엔카 마이그레이션 대비. |

---

## 9. 테스트 전략

| 레이어 | 테스트 파일 | 중점 |
| --- | --- | --- |
| Parsers | `tests/parsers-*.test.ts` (+`fixtures`) | 실제 API 샘플 / HTML 스냅샷 → 기대 `FieldStatus` |
| Bridge | `tests/bridge*.test.ts`, `tests/integration.test.ts` | 개인/딜러 분기, R04 3-layer 계층, R08 월수 계산 |
| Rules | `tests/rules-*.test.ts`, `tests/evaluation.test.ts` | severity 매핑, null 드랍, verdict / score 공식, fixture 회귀 |

**fixture 기반 회귀** — `src/__fixtures__/samples.ts` 에 캡처된 실제 매물 페이로드(001~007) 가 주요 분기의 기준점이다. 룰을 바꿨을 때 어떤 sample 이 verdict 를 바꿨는지 diff 로 추적 가능해야 한다.

---

## 10. 빠른 참조: 파일 투어

```
src/background/
├── index.ts                          서비스워커 — 메시지 라우팅, collect orchestration, 캐시, sweep
└── main-world-collector.ts           executeScript MAIN world 함수 (stringified 주입용)

src/content/fem-encar/
├── index.ts                          ISOLATED world — main-world 브리지 + chrome.runtime 전송, SPA 네비 감지
└── main-world.ts                     MAIN world — __PRELOADED_STATE__ + api.encar.com fetch

src/core/parsers/encar/
├── index.ts                          orchestrate() — 5개 소스 결합 → EncarParsedData
├── state.ts                          __PRELOADED_STATE__ / __NEXT_DATA__ 추출 + deepFind fallback
├── api-record.ts                     record JSON + insurance gap 파생
├── api-diagnosis.ts                  diagnosis JSON + getFrameIntact
└── api-inspection.ts                 inspection JSON + getFrameFromInspection

src/core/collectors/
├── sources.ts                        SourceId 레지스트리 + 우선순위
└── merge.ts                          mergeFieldStatus — cross-validation primitive

src/core/bridge/
└── encar-to-facts.ts                 사이트 → 사이트불문. F1·F2·F3 불변식 적용

src/core/rules/
└── index.ts                          r01~r11 + evaluate() + severity 스코어링

src/core/types/
├── FieldStatus.ts                    5-state discriminated union + 생성자 헬퍼
├── ParsedData.ts                     EncarParsedData / EncarCarBase / DetailFlags
├── ChecklistFacts.ts                 사이트 불문 fact 구조
└── RuleTypes.ts                      Rule / RuleResult / RuleReport / Severity / Verdict

src/core/storage/db.ts                Dexie 스키마 (cache, acks) + sweepExpired
src/core/messaging/protocol.ts        Message discriminated union + isMessage 가드
src/core/evaluation/                  AI 평가 (LLM) — 룰 엔진과 독립 레이어
src/core/llm/                         Gemini / OpenAI 클라이언트
```

---

## 11. 참조 문서

- [README.md](../../README.md) — 제품 개요
- [docs/superpowers/specs/2026-04-09-sidepanel-brutalist-redesign.md](../../docs/superpowers/specs/2026-04-09-sidepanel-brutalist-redesign.md) — 사이드패널 UX 스펙
- [CLAUDE.md](../../CLAUDE.md) — 프로젝트 개발 가이드
