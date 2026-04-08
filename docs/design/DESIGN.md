# daksin-car — 제품 설계서 (Design Doc)

**Status**: v1 draft
**Date**: 2026-04-08
**Codename**: `dakshin-car` (제품명 변경 예정)
**Owner**: kwanung
**Related**:
- Discovery: [docs/discovery/encar/README.md](../discovery/encar/README.md)
- Implementation Plan: [docs/plan/IMPLEMENTATION.md](../plan/IMPLEMENTATION.md)
- Plan Review: [docs/plan/REVIEW.md](../plan/REVIEW.md)
- Code Review: [docs/plan/CODE_REVIEW.md](../plan/CODE_REVIEW.md)

---

## Section 1 — Product Overview

### 1.1 한 줄 정의
Encar 매물 페이지에서 **닥신 11 룰 체크리스트**를 자동 평가해, 사용자가 함정 매물을 한 번에 걸러낼 수 있게 해주는 **Chrome Extension**.

### 1.2 해결하려는 문제
- 엔카 메인 페이지는 "프레임무사고", "엔카진단 통과", "보험이력 0건" 같은 **긍정 배지**만 강조한다.
- 결정적인 위험 (렌트 이력, 자차보험 공백, 미진단)은 **별도 페이지/로그인 뒤** 숨어있다.
- 사용자는 매물을 하나씩 11개 룰로 수동 평가해야 하고, 이게 귀찮아서 결국 함정 매물에 빠진다.

### 1.3 핵심 가치
1. **자동 트리거** — 매물 페이지를 여는 즉시 평가 시작.
2. **위험 신호 우선 노출** — pass 룰이 아니라 **killer/warn 부터** 보여준다.
3. **결정론적·검증 가능** — AI 추론이 아니라 **고정된 코드·정규식**으로 판정. 같은 매물이면 같은 결과.
4. **사용자 주권** — 킬러 룰은 **하드 비토** 하지만 사용자가 7일간 ack 하면 무시 가능.

### 1.4 비목표 (Non-goals)
- 시세 예측, 리세일 추정 같은 **AI/통계 분석 미포함**.
- Encar 외 사이트 (KCar, KB차차차 등) 는 **MVP 범위 외** (Layer B 가 site-agnostic 이라 차후 확장 가능).
- 모바일 앱·웹사이트·서버 백엔드 없음. **순수 Chrome Extension**.

### 1.5 사용자 페르소나
- **P1 입문자**: 중고차 처음 사는 30대, 닥신 영상으로 11 룰만 안다. 자동 평가가 필요.
- **P2 경험자**: 이미 엔카에서 수십 매물 본 사람. 한눈에 위험 신호만 빠르게 확인하고 싶음.
- **P3 딜러 회피형**: 중고차 딜러 영업/거짓말 회피가 목적. 객관적 데이터만 신뢰.

### 1.6 성공 지표 (MVP)
- ✅ 4개 디스커버리 샘플의 verdict 가 100% 일치
- ✅ 로그인 미상태에서도 R01~R04, R11 부분 평가
- ✅ 사용자 ack 7일 retention 동작
- 사용자 베타: **첫 평가까지 < 3초**, **수동 재평가 1-click**

---

## Section 2 — 도메인 모델 (4-Layer)

> "파싱할 수 있는 데이터" 와 "체크리스트 룰" 을 **분리**해, 사이트가 바뀌어도 룰을 안 건드리고, 룰이 바뀌어도 파서를 안 건드리도록 한다.

```
┌─────────────────────────────────────────────────────────┐
│ Layer A — EncarParsedData    (site-specific, raw)       │
│   raw.base, raw.detailFlags, raw.uiData, raw.dom*       │
│   각 필드는 FieldStatus<T>                              │
└──────────────────┬──────────────────────────────────────┘
                   │ Bridge (encar-to-facts.ts)
                   │ - F1: 법인≠렌트 불변식
                   │ - F2: insurance.type='insurance'만 사고
                   │ - F3: 날짜 string 그대로
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Layer B — ChecklistFacts     (site-agnostic)            │
│   insuranceHistoryDisclosed, usageHistory, insuranceGap │
│   ... 11 facts, 모두 FieldStatus<T>                     │
└──────────────────┬──────────────────────────────────────┘
                   │ rules/index.ts (pure functions)
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Layer D — RuleResult[] + RuleReport                     │
│   { verdict, score, killers, warns, results }           │
└──────────────────┬──────────────────────────────────────┘
                   │ UI subscribes
                   ▼
┌─────────────────────────────────────────────────────────┐
│ UI: FloatingChip + Side Panel (3 tabs)                  │
└─────────────────────────────────────────────────────────┘
```

### 2.1 FieldStatus<T> 5상태

| kind | 의미 | 룰 처리 | UI 표시 |
|---|---|---|---|
| `value` | 정상 추출됨 | 룰 평가 | 색상별 (green/yellow/red) |
| `hidden_by_dealer` | 딜러가 의도적 비공개 | `fail` | 🔴 빨강 (의심) |
| `parse_failed` | 파서 한계/login_required/기타 | `unknown` | ⚪ 회색 (중립) |
| `loading` | 수집 진행 중 | `unknown` | 🌀 스피너 |
| `timeout` | 8s 초과 | `unknown` | ⏱ 회색 |

> **딜러 비공개 ≠ 파서 실패** 의 구분이 핵심. 같은 "데이터 없음" 상태도 사용자에게 전혀 다르게 보여준다.

### 2.2 사이트 추가 시 작업
새 사이트(예: KCar) 추가 = **새 parser 디렉토리 + 새 bridge 함수**. Layer B/D 는 1줄도 안 건드린다.

---

## Section 3 — Collection Pipeline

### 3.1 5 데이터 소스

| ID | URL | 획득 수단 | 로그인 |
|---|---|---|---|
| S1 | `fem.encar.com/cars/detail/{id}` | `__PRELOADED_STATE__.cars` | X |
| S2 | 〃 (같은 페이지) | DOM `innerText` | X |
| S3 | `car.encar.com/history?carId={id}` | `__NEXT_DATA__.uiData` | ✅ |
| S4 | `fem.encar.com/cars/report/diagnosis/{id}` | SSR HTML | 부분 |
| S5 | `fem.encar.com/cars/report/inspect/{id}` | SSR HTML | 부분 |
| S6 | `fem.encar.com/cars/report/accident/{id}` | SSR HTML (accordion 펼침) | ✅ |

### 3.2 파서 안정성 원칙
- ❌ **class 셀렉터 금지** — Encar 의 class 는 전부 해시 (`EtIRdQ8gjq`)
- ✅ `data-enlog-dt-eventname` / `data-enlog-dt-eventnamegroup`
- ✅ `dt`/`dd` 라벨 매칭 ("연식", "주행거리", "차량번호")
- ✅ `innerText` 라인 기반 화이트리스트 + **정확 매칭 정규식**
- ✅ JSON state 우선, DOM 폴백

### 3.3 State Machine

```
opened ──▶ detected ──▶ collectingS1+S2 ──▶ collectingS3..S6 (parallel)
                              │                       │
                              └─ on miss ──▶ cache ◀──┘
                                              │
                                              ▼
                                          bridging
                                              │
                                              ▼
                                          evaluating
                                              │
                                              ▼
                                            done
```

각 stage 의 실패는 `FieldStatus.parse_failed{reason}` 로 다음 단계에 전파. 전체 파이프라인은 **부분 결과** 도 항상 사용 가능.

### 3.4 타임아웃 정책
- 개별 fetch 8s
- 전체 수집 15s hard limit → 부분 verdict 출력
- 사용자가 "↻ 재평가" 를 눌러 재시작 가능

### 3.5 캐시 / 무효화
- IndexedDB cache 24h
- 수동 refresh 시 강제 무효화
- 7일 ack는 별도 테이블 (cache TTL 과 독립)

---

## Section 4 — Rule Engine + Coverage Matrix

### 4.1 11 룰 정의 (닥신)

| ID | 제목 | 종류 | 입력 fact | 판정 |
|---|---|---|---|---|
| R01 | 보험이력 공개 | 정보 공개 | `insuranceHistoryDisclosed` | true=pass / false=fail |
| R02 | 성능점검 공개 | 정보 공개 | `inspectionReportDisclosed` | true=pass / false=fail |
| R03 | 엔카진단 통과 | **KILLER** | `hasEncarDiagnosis` | true=pass / false=killer |
| R04 | 프레임 무사고 | **KILLER** | `frameDamage.hasDamage` | false=pass / true=killer |
| R05 | 렌트/택시/영업 없음 | **KILLER** | `usageHistory.{rental,taxi,business}` | all false=pass / any true=killer |
| R06 | 전손/침수/도난 없음 | **KILLER** | `totalLossHistory` | false=pass / true=killer |
| R07 | 1인 신조 | 가산 | `ownerChangeCount` | ≤1=pass / >1=warn |
| R08 | 자차보험 공백 없음 | **KILLER** | `insuranceGap` | false=pass / true=killer |
| R09 | 수리비 미확정 없음 | 가산 | `unconfirmedAccident` | false=pass / true=warn |
| R10 | 자잘한 사고 처리 | 가산 | `minorAccidents.{ownDamageWon,otherDamageWon,domestic}` | max < 임계 → pass / 초과 → warn |
| R11 | 가격 적정성 | 가산 | `priceVsMarket.ratio` | 0.5~1.0 → pass / 그 외 → warn |

**임계값**:
- R10 국산차 100만원, 외제차 200만원
- R11 신차대비 50%~100% 가 정상 (MVP — 시세 API 연동 후 보강)

### 4.2 Verdict 산출

```
verdict =
  killers.length > 0           → 'NEVER'
  warns.length > 0              → 'CAUTION'
  any unknown && no warn        → 'UNKNOWN'
  else                          → 'OK'
```

### 4.3 Score (0~100)
- pass = 10점, warn = 4점, fail = 0점, killer = 0점, unknown = 5점
- (sum / max) * 100 반올림
- **단, killer 가 있으면 verdict 는 NEVER 로 고정** (score 와 별개)

### 4.4 Coverage Matrix (Discovery 기반)

| 룰 | 소스 | 로그인 필요 | MVP 신뢰도 |
|---|---|---|---|
| R01 | S1 detailFlags | X | 🟢 |
| R02 | S1 detailFlags | X | 🟢 |
| R03 | S1 detailFlags | X | 🟢 |
| R04 | S2 DOM / S4 report | X | 🟢 (진단차) |
| R05 | S3 uiData | ✅ | 🟢 |
| R06 | S3 uiData | ✅ | 🟡 |
| R07 | S3 uiData | ✅ | 🟡 |
| R08 | S3 uiData | ✅ | 🟢 |
| R09 | S6 accident | ✅ | 🟡 |
| R10 | S3 insurance | ✅ | 🟢 |
| R11 | S1 base | X | 🟡 (시세 미연동) |

→ **로그인 안 한 사용자**는 R01~R04, R11 만 부분 평가 받고, 나머지는 "로그인 후 확인" CTA.

---

## Section 5 — UI/UX 설계

### 5.1 디스플레이 모드: Hybrid (Floating Chip + Side Panel)

```
┌──────────────────── Encar 매물 페이지 ────────────────────┐
│                                                            │
│   매물 사진 / 가격 / 옵션 ...                              │
│                                              ┌──────────┐ │
│                                              │ 🚨 NEVER │ │ ◀ Floating chip
│                                              │ 32/100   │ │   (오른쪽 하단 고정)
│                                              └──────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
                                  │
                          chip click
                                  ▼
┌──────── Side Panel ────────┐
│ [위험] [스코어] [체크리스트] │ ◀ 3 tabs (위험 default)
├────────────────────────────┤
│ 🚨 R05 렌트 이력 확인됨    │
│   [이 경고 인정 (7일)]     │
│ 🚨 R08 자차보험 공백 49개월│
│   [이 경고 인정 (7일)]     │
│ ⚠ R10 보험처리 257만원     │
│ ✅ R01~R04, R06 통과       │
└────────────────────────────┘
```

### 5.2 Floating Chip 상태

| verdict | 색 | 아이콘 | 텍스트 |
|---|---|---|---|
| OK | 초록 | ✅ | "OK · 88/100" |
| CAUTION | 노랑 | ⚠ | "주의 · 64/100" |
| UNKNOWN | 회색 | ❔ | "확인필요" |
| NEVER | 빨강 | 🚨 | "NEVER · 32/100" |
| LOADING | 파랑 | 🌀 | "수집중..." |
| LOGGED_OUT | 회색 | 🔒 | "로그인 필요" |

### 5.3 위험 신호 탭 (default 랜딩)
- killer 룰부터 위에서부터 카드형 노출
- warn 그 다음
- pass/unknown 은 접힘
- 각 killer 카드 하단에 **"이 경고 인정 (7일)"** 버튼

### 5.4 Acknowledge 흐름
1. 사용자가 ack 클릭 → 다이얼로그: "정말 무시하시겠습니까? 7일 동안 이 룰은 비활성화됩니다."
2. 확인 → IndexedDB `acks` 테이블 insert
3. RuleEngine 재평가 시 ack 된 룰은 verdict 계산에서 제외 (UI 에는 "사용자가 무시함" 배지로 표시)
4. 7일 후 자동 만료 (background alarm sweeper)

### 5.5 로그인 미상태 UX
- 부분 verdict 출력
- 위험 탭 상단에 노란 배너: **"로그인하면 R05/R08 등 핵심 룰을 평가할 수 있습니다 [로그인하기]"**
- [로그인하기] → `https://member.encar.com/login` 새 탭

### 5.6 디버그 탭 (개발 모드만)
- 원본 ParsedData JSON dump
- ChecklistFacts JSON dump
- 각 룰의 evidence 펼쳐보기

---

## Section 6 — 에러 처리 / 상태 머신 / 테스팅

### 6.1 로그인 상태 머신

```
unknown ──┬─ cookie 존재 + S3 200 ─▶ logged_in
          ├─ S3 redirect/401  ─────▶ logged_out
          └─ S3 200 + "로그인후"   ─▶ session_expired
```

`session_expired` 도 UX 상으론 `logged_out` 과 동일 (재로그인 유도).

### 6.2 데이터 결손 시나리오

| 상황 | 감지 | 처리 |
|---|---|---|
| `__PRELOADED_STATE__` 없음 | `extractBase()=parse_failed` | 페이지가 매물 페이지가 아님 → chip 미노출 |
| `__NEXT_DATA__` 없음 | `extractUiData()=parse_failed` | R05~R10 unknown 표시 + CTA |
| 500 에러 | fetch reject | "엔카에서 이력을 제공하지 않는 매물" 메시지 |
| 비정상 날짜 (3000년) | string 그대로 통과 | UI 에서 raw 값만 표시, 정렬/계산 안 씀 |
| 로그인 미상태 | 응답 본문 정규식 | `parse_failed{reason: 'login_required'}` |

### 6.3 테스트 전략 (4 계층)

1. **유틸 단위** — `wonToNumber`, `splitLines` 등
2. **파서 단위** — fixture HTML/JSON → ParsedData snapshot
3. **Bridge 단위** — ParsedData → ChecklistFacts (불변식 F1/F2 강제)
4. **통합** — 4 실 샘플 + 1 합성 ideal 샘플 → verdict 일치

**커버리지 목표**:
- core/ ≥ 85%
- rules/ = 100%
- bridge/ = 100% (불변식이 회귀하면 안 됨)

**Verified 상태 (2026-04-08)**:
```
Test Files  2 passed (2)
     Tests  17 passed (17)
```

### 6.4 회귀 전략
- 새 샘플 발견 → `samples/00X-*.md` 추가 + `__fixtures__/` 에 fixture 추가 + integration test 추가
- 사이트 DOM 변경 시 → 파서만 수정, 룰/bridge/UI 무수정
- 룰 가중치 변경 시 → `rules/` 만 수정

---

## Section 7 — 미해결 / 백로그

### 7.1 Discovery 미발견 케이스
- 🔲 **이상적 PASS 실 매물** (1인신조 + 진단 + 무사고 + 보험공백 없음)
- 🔲 **딜러가 보험이력 비공개** 매물 → `isInsuranceExist=false` UI
- 🔲 **프레임 손상 실 매물** → `frameDiag=수리|교환` 관측
- 🔲 **전손/침수/도난** 매물

### 7.2 Phase 2 백로그
- Chrome Extension shell (manifest.ts, background SW, content scripts, side panel)
- Dexie 영속화 + export/import
- R12 리콜 / R13 노후·고주행 (가산형)
- R11 외부 시세 API 연동
- KCar/KB 차차차 등 멀티 사이트
- E2E Playwright

### 7.3 리스크
- @crxjs/vite-plugin 2 beta 호환성 → Phase 2 verify gate 에서 결정
- 로그인 쿠키 이름 미확정 → 응답 텍스트 감지로 우회 (현재 구현)
- 시세 외부 API 라이선스/요금 미조사

---

## Section 8 — 의사결정 로그

| 결정 | 옵션 | 채택 | 이유 |
|---|---|---|---|
| 데이터 수집 | A) DOM 파싱 / B) LLM 비전 / C) 외부 API | **A** | 결정론·재현·법적 안전 |
| 비공개 vs 파싱실패 구분 | 회색만 / 빨강만 / 둘 분리 | **분리** | 사용자가 다른 의사결정 |
| 킬러 룰 정책 | 소프트 경고 / 하드 비토 / 비토+ack | **비토+ack 7일** | 사용자 주권 + 안전 기본값 |
| 저장소 | localStorage / IndexedDB / 백엔드 | **IndexedDB + export** | 용량·구조·프라이버시 |
| Retention | 영구 / 24h / 7일 | **cache 24h, ack 7일, saved 영구** | UX vs 신선도 |
| UI 모드 | sidepanel / overlay / popup / hybrid | **hybrid (chip+sidepanel)** | 접근성+세부정보 |
| 1차 사이트 | Encar / KCar / 둘 다 | **Encar only** | MVP 집중 |
| 4-Layer 분리 | 단일 모델 / 4-Layer | **4-Layer** | 사이트 변경 격리 |
| AI 사용 | 허용 / 금지 | **금지** | 결정론 + 사용자 신뢰 |

---

## Section 9 — 글로서리

- **닥신 / 닥터신**: 한국 중고차 평가 유튜버. 11 룰 체크리스트의 출처.
- **자차보험 공백**: 차량 등록 후 자차보험을 가입하지 않은 기간. R08 의 직접 신호.
- **킬러 룰 (Killer Rule)**: 위반 시 verdict 를 NEVER 로 고정시키는 룰. 사용자가 ack 로만 우회 가능.
- **FieldStatus**: 파싱 결과의 5상태 ADT (value/hidden/parse_failed/loading/timeout).
- **Bridge**: Layer A → Layer B 변환 함수. 불변식의 본거지.
- **enlogData**: Encar 가 자체적으로 부착하는 위험 카테고리 태그 (`new_release_corporate`, `noinsured` 등).
