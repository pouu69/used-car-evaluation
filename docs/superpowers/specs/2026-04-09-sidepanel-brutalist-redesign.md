# 사이드패널 UX 개편 — Brutalist Scoreboard

**Date:** 2026-04-09
**Status:** Approved (ready for implementation planning)
**Scope:** `src/sidepanel/**` only. Core/rules/messaging layers unchanged.

---

## 1. Purpose

기존 사이드패널은 체크리스트를 단조로운 세로 리스트로 보여준다. 매물의 위험도·카테고리별 건강 상태·핵심 증거 데이터가 시각적으로 드러나지 않아, 사용자가 스크롤하며 읽어 내려가야 한다.

본 개편은 사이드패널을 **"편집형 스코어보드"** 로 재구성하여 다음을 달성한다:

- 한눈에 "이 매물이 살 만한가?" 판단 가능 (점수 + verdict + 요약)
- 카테고리별 건강 상태를 공간적으로 보여줌 (레이더 차트)
- 위험 룰은 색 반전으로 리스트 안에서 즉시 돌출됨
- 통계와 필터를 한 컴포넌트로 통합 (정보 중복 제거)

## 2. Design Direction — Brutalist Scoreboard

### 2.1 미학 원칙

- **거대한 숫자** — 점수는 시각적 무게중심
- **두꺼운 경계선** — 4px black borders, 섹션 간 분명한 분리
- **형광 옐로우(#e4ff00) 포인트** — verdict, WARN, 활성 상태
- **적색(#ff2d4b) 포인트** — FATAL, killer 룰에만 제한 사용
- **흑백 기본** — 화면의 70% 이상이 흑/백, 색은 signal 로만
- **정보 반복 금지** — 같은 숫자를 두 번 보여주지 않음

### 2.2 타이포그래피

| 용도 | 폰트 | 가중치 |
|---|---|---|
| 디스플레이 (점수, 제목) | `Archivo Black` | 900 |
| 라벨, 모노스페이스 숫자 | `Space Mono` | 400, 700 |
| 본문 | `Inter Tight` | 400, 600, 700, 800 |

Google Fonts 로드: `@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&family=Inter+Tight:wght@400;600;700;800&display=swap');`

### 2.3 컬러 팔레트

```
BLACK     #000000    기본 텍스트, 경계선, 활성 탭 배경
WHITE     #ffffff    기본 배경
YELLOW    #e4ff00    VERDICT 박스, WARN 룰 배경, 활성 강조
RED       #ff2d4b    FATAL 룰 배경, killer 경고 도트
GRAY      #f0f0f0    N/A / unknown 룰 배경
```

## 3. Layout & Sections

### 3.1 섹션 순서 (세로)

```
┌─────────────────────────────┐
│ [HERO]                      │  점수(86px) + VERDICT 박스(옐로우)
├─────────────────────────────┤
│ [CAR STRIP]                 │  BMW 520D M SPORT / spec / price
├─────────────────────────────┤
│ [TAB BAR] CHECKLIST|AIREVIEW│  Hero 아래, 탭 전환의 기준점
├─────────────────────────────┤
│ ── CHECKLIST 탭일 때 ──     │
│ [HEALTH RADAR]              │  5축 펜타곤, 옐로우 폴리곤
│ [FILTER TABS]               │  ALL 11 | FATAL 1 | WARN 3 | PASS 6 | N/A 1
│ [RULE GROUPS]               │  카테고리 헤더 + 룰 카드들 (증거 노출)
│ [ACTION BAR]                │  재평가 | AI 평가로 이동
│                             │
│ ── AI REVIEW 탭일 때 ──     │
│ [AiEvaluationPanel]         │  기존 컴포넌트 재사용 (브루탈 스킨은 후속)
└─────────────────────────────┘
```

**Hero + CAR STRIP + TAB BAR 는 두 탭 공통** (차량 정체성은 항상 상단에).

### 3.2 HERO

- 좌: SCORE 영역
  - 라벨 `SCORE` (Space Mono, 8px, 2px 자간)
  - 숫자 (Archivo Black, **86px**, line-height 0.85, 자간 -3px)
  - 서브 `OUT OF 100` (Space Mono, 10px, opacity 0.6)
  - 패딩 `8px 8px 6px 14px`
- 우: VERDICT 영역 (flex: 1)
  - 배경 `#e4ff00`, 좌측 경계 4px 검정
  - 태그 `◆ VERDICT` (Space Mono, 8px)
  - 라벨 (Archivo Black, 20px, line-height 0.9, 최대 2줄)
    - `NEVER` → `"DO NOT\nBUY."`
    - `CAUTION` → `"CAUTION.\nREAD ME."`
    - `OK` → `"GOOD."`
    - `UNKNOWN` → `"CHECK\nTHIS."`
    - `\n` 는 `<br/>` 로 렌더링
  - 요약 한 줄 (Space Mono, 9px): killer/warn 룰의 short title 상위 2~3개를 ` · ` 로 조합
  - 우상단 12px 적색 도트 (killer 가 있을 때만 표시)
- Hero 하단 4px 검정 경계

### 3.3 CAR STRIP

- make: `{manufacturerName} {modelName} {gradeName}` (Archivo Black, 14px, uppercase)
- spec: `{year.month} · {mileage} KM · 차량번호 · #{carId}` (Space Mono, 10px, opacity 0.75)
- price: `{price}만원` (Archivo Black, 18px)
- 하단 4px double 경계

### 3.4 TAB BAR

- 2열 그리드, CHECKLIST / AI REVIEW
- 각 탭: Archivo Black 15px, 2줄 (메인 라벨 + 서브 스펙 라벨)
  - 서브: `◼ 11 RULES` / `◇ GEMINI / GPT`
- 활성 탭: 배경 `#000`, 글씨 `#fff`
- 중앙 경계 4px 검정
- 하단 4px 검정 경계
- **sticky 아님** — 평범하게 스크롤과 함께 밀림 (탭 전환 빈도가 낮음)

### 3.5 HEALTH RADAR

- 5축 정펜타곤 SVG
- 축: `CATEGORY_ORDER` 순서 (차량상태, 이력, 사고, 가격, 투명성)
- 각 축 값: 해당 카테고리 내 `pass` 비율 (0~100%)
- 배경 그리드: 4개 링 (흑색, 외곽 1.5px 굵게, 나머지 0.75px opacity 0.25)
- 축선: 검정 점선 `stroke-dasharray: 2 3`, opacity 0.4
- 데이터 폴리곤: fill `#e4ff00`, stroke `#000` 3px
- 꼭짓점 점: 검정 5px 원
- 라벨: Archivo Black 11px + Space Mono 9px 서브 (`n/m · XX%`)
- **축 점수 < 50% 이면 해당 축 라벨을 적색으로** (약점 강조)
- SVG viewBox `0 0 360 300`, 반응형 `width: 100%`

### 3.6 FILTER TABS (스탯 겸용)

- 5열 그리드 (ALL / FATAL / WARN / PASS / N/A)
- 각 탭:
  - 카운트 (Archivo Black, 28px)
  - 라벨 (Space Mono, 8px, 1.2px 자간)
  - 패딩 `12px 2px 10px`
- 배경 색:
  - ALL: 검정/흰
  - FATAL: `#ff2d4b` / 흰
  - WARN: `#e4ff00` / 검정
  - PASS: 흰 / 검정
  - N/A: `#f0f0f0` / 검정
- 경계: 각 탭 사이 2px 검정, 섹션 하단 4px 검정
- **활성 탭 표시**: 상단 5px 검정 띠 (`::before`)
  - ALL 탭이 활성일 때는 띠 색을 `#e4ff00` 로 (검정 배경 위에 대비)

### 3.7 RULE GROUPS

- 카테고리별로 `RuleGroup` 컴포넌트 렌더
- 그룹 헤더:
  - 배경 검정, 글씨 흰
  - 좌: `◼ 이력 / History` (Space Mono, 9px, 2px 자간, 700)
  - 우: `2 / 6` (Archivo Black, 12px), pass 비율 < 50% 면 `#ff2d4b`, >= 80% 면 `#e4ff00`, 중간은 흰
- 그룹 하단 3px 검정 경계

### 3.8 RULE CARD

- 3열 그리드: `[num] [body] [mark]`
- num: `01`~`11` (Archivo Black, 16px) — **기존 RULE_META.icon 은 사용하지 않음**
- body:
  - title: `RULE_META[ruleId].shortTitle ?? result.title` (Archivo Black, 14px, uppercase)
  - message: `result.message` (Inter Tight, 11px, line-height 1.5)
    - **v1 에서는 하이라이트 `<b>` 적용 안 함** — 메시지를 원문 그대로 출력
  - tags: severity 기반 자동 생성
    - `killer` → `KILLER` + `DO NOT BUY`
    - `warn` → `WARN`
    - `unknown` → `N/A`
    - `pass`/`fail` → 태그 없음
- mark: Archivo Black 22px
  - `killer` → `✕`
  - `warn` → `▲`
  - `pass` → `✓`
  - `unknown` → `?`
  - `fail` → `✕`
- 배경 반전:
  - `killer` 또는 `fail` → `#ff2d4b` 배경, 흰 글씨
  - `warn` → `#e4ff00` 배경, 검정 글씨
  - 그 외 → 흰 배경, 검정 글씨
- 룰 간 경계: 1px 검정
- Ack 버튼: `result.acknowledgeable && result.severity === 'killer'` 일 때만
  - 라벨 `IGNORE 7D` (Space Mono, 8px), 투명 배경, 1px 흰 경계 (적색 배경 위이므로)
  - 클릭 시 `confirm()` → `ACK_RULE` 메시지 전송 (기존 플로우 유지)

### 3.9 ACTION BAR

- 2열 그리드, 상단 4px double 경계
- 좌: `↻ 재평가` (Archivo Black 13px, 검정 글씨 / 흰 배경, 중앙 2px 검정 경계)
- 우: `AI 평가 →` (검정 배경, 흰 글씨) → 클릭 시 `setTab('ai')`

### 3.10 LOADING VIEW / EMPTY STATE / ERROR

- 동일 브루탈 스킨 적용:
  - 거대한 단어 1~2개 (Archivo Black, 60~80px): `LOADING`, `NOT A CAR`, `ERROR`
  - Space Mono 9px 서브 메시지
  - 검정 4px 경계 박스 안에 표시
- Spinner 는 **사용하지 않음** — 점수 자리에 `--` 표시 + "FETCHING REPORT" 라벨

## 4. Motion

총 4종, 전부 로드 시 1회만. hover/parallax/scroll-triggered 모션 없음.

| 모션 | 타겟 | 파라미터 |
|---|---|---|
| ① 점수 카운트업 | SCORE 숫자 | 0 → score, 600ms, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out) |
| ② 레이더 draw-in | radar polygon | `stroke-dasharray` 애니메이션, 500ms, ease-out, 카운트업 200ms 후 시작 |
| ③ 룰 카드 stagger | RuleCard | opacity 0→1, translateY 4px→0, 각 카드 50ms 간격, 300ms duration |
| ④ 탭 전환 | CHECKLIST ↔ AI | 컨텐츠 fade 150ms |

구현:
- ①: `useCountUp(targetScore, 600)` 훅, `requestAnimationFrame` 기반
- ②: CSS keyframes + `stroke-dasharray` / `stroke-dashoffset`
- ③: CSS animation + `animationDelay: ${i * 50}ms`
- ④: `opacity` transition 150ms

`prefers-reduced-motion: reduce` 시 모든 모션 비활성화.

## 5. Data Mapping

신규 UI는 **데이터 모델 변경 없이** 기존 타입만 소비한다.

### 5.1 입력 (변경 없음)

- `CacheRow.parsed: EncarParsedData`
- `CacheRow.facts: ChecklistFacts`
- `CacheRow.report: RuleReport` — `{verdict, score, results, killers, warns}`
- `RULE_META[ruleId]` — `category`, `shortTitle` 사용 (`icon` 필드는 무시)

### 5.2 매핑 테이블

| UI 요소 | 데이터 출처 | 변환 |
|---|---|---|
| HERO score | `report.score` | 그대로 |
| HERO verdict | `report.verdict` | enum → 문구 매핑 (§3.2) |
| HERO 요약 | `report.killers`, `report.warns` | 상위 2~3 title 조합 |
| HERO 적색 도트 | `report.killers.length > 0` | 존재 시 렌더 |
| CAR STRIP | `parsed.raw.base.value.*` | 기존 `buildCarTitle` 로직 재사용·분리 |
| RADAR 축 값 | `results` + `RULE_META[ruleId].category` | 카테고리별 `pass/total * 100` |
| RADAR 축 적색 라벨 | 축 점수 < 50% | 라벨 fill `#ff2d4b` |
| FILTER 카운트 | `counts.{killers, warns, passes, unknowns}` | 기존 `counts` useMemo 재사용 |
| RULE GROUPS | `results` → `CATEGORY_ORDER` 순 그룹핑 | 기존 `grouped` useMemo 재사용 |
| RULE GROUP 카운트 | `pass / total` 비율 | < 50 red / >= 80 yellow / mid white |
| RULE num | 룰 인덱스 (`ruleId` 뒤 숫자 파싱) | `R06` → `06` |
| RULE title | `RULE_META[id].shortTitle ?? r.title` | |
| RULE message | `r.message` | 원문 그대로 |
| RULE tags | `r.severity` | 매핑 (§3.8) |
| RULE mark | `r.severity` | 매핑 (§3.8) |
| RULE 배경 | `r.severity` | 매핑 (§3.8) |
| ACK 버튼 | `r.acknowledgeable && r.severity === 'killer'` | 조건부 렌더 |

### 5.3 v1 에서 제외

- "동급 평균 대비 N배" 같은 **비교 문구** — 현재 규칙 엔진이 생성하지 않음. 향후 `RuleResult` 에 `context?: string[]` 필드 추가 시 노출.
- 메시지 내 숫자 **`<b>` 하이라이트** — 원문 문자열 파싱 복잡도. 향후 `RuleResult.highlights?: string[]` 로 해결.

## 6. Component Breakdown

```
sidepanel/
├── App.tsx                    — 데이터 로드 shell, 탭/필터 상태 (~150 LOC)
├── main.tsx                   [변경 없음]
├── index.html                 [변경 없음]
├── rule-meta.ts               [변경 없음, icon 필드는 사용 안 함]
├── AiEvaluationPanel.tsx      [변경 없음, 브루탈 스킨은 후속 작업]
│
├── theme.ts                   🆕 COLORS, FONTS, GOOGLE_FONTS_IMPORT, globalCss
│
├── components/
│   ├── Hero.tsx               🆕 점수 + verdict 블록
│   ├── CarStrip.tsx           🆕 차량 정체성 바 (buildCarTitle 재사용)
│   ├── TabBar.tsx             🆕 Checklist/AI Review 탭 (기존 TabBar 대체)
│   ├── HealthRadar.tsx        🆕 SVG 레이더 + 카테고리 계산
│   ├── FilterTabs.tsx         🆕 5탭 (스탯 겸용)
│   ├── RuleGroup.tsx          🆕 카테고리 헤더 + 룰 카드들
│   ├── RuleCard.tsx           🆕 단일 룰 (증거 + 태그 + mark + ack)
│   ├── ActionBar.tsx          🆕 재평가 / AI 평가 이동
│   ├── LoadingView.tsx        🆕 브루탈 스킨 로딩
│   ├── EmptyState.tsx         🆕 브루탈 스킨 빈 상태
│   └── ErrorView.tsx          🆕 브루탈 스킨 에러
│
└── hooks/
    ├── useCarData.ts          🆕 chrome.runtime 메시징, load/refresh/ack
    └── useCountUp.ts          🆕 requestAnimationFrame 카운트업
```

**파일 크기 목표**: 각 컴포넌트 파일 < 200 LOC, App.tsx < 200 LOC.

**스타일링 방식**: CSS-in-JS 라이브러리 없음. 각 컴포넌트 내부에 `const css = \`...\``  문자열 상수 + App 루트에서 한 번만 `<style>{theme.globalCss + Hero.css + ...}</style>` 주입. className 기반.

## 7. Interaction Flow

```
사용자 탭 열기
  ↓
useCarData → chrome.runtime.sendMessage('GET_LAST')
  ↓ cache miss
  COLLECT_FOR_TAB 트리거
  ↓
  ├─ LoadingView (브루탈 스킨)
  ↓ COLLECT_RESULT 수신
  ↓
  App 정상 렌더:
    Hero (카운트업 시작)
    CarStrip
    TabBar (기본 active: checklist)
    HealthRadar (draw-in 시작)
    FilterTabs (active: all)
    RuleGroups (stagger 시작)
    ActionBar
  ↓
사용자 상호작용:
  - FilterTabs 클릭 → filter 상태 변경 → RuleGroups 재필터링
  - TabBar 클릭 → tab 상태 변경 → CHECKLIST ↔ AI 전환 (fade)
  - ActionBar 재평가 → refresh() → LoadingView → 재진입
  - RuleCard Ack (killer만) → confirm → ACK_RULE 메시지 → load() 재호출
  - ActionBar AI 평가 → setTab('ai')
```

## 8. Out of Scope

- `AiEvaluationPanel.tsx` 의 내부 디자인 (후속 이슈에서 브루탈 스킨 적용)
- `core/rules/` 규칙 엔진 변경
- `RuleResult` 타입 확장 (context, highlights 등)
- 다크 모드 (브루탈리즘은 기본 라이트, 필요하면 별도 이슈)
- 반응형 (사이드패널은 고정 폭 유지)
- i18n (기존과 동일, 한글 고정)

## 9. Risks & Open Questions

| 위험 | 완화 |
|---|---|
| Google Fonts 로드 실패 시 폰트 깨짐 | `font-family` 에 `sans-serif` fallback, 중요 텍스트는 weight 로 대체 강조 |
| `Archivo Black` 글리프 부족 (한글 없음) | 한글 텍스트는 `Inter Tight 800` 으로 대체 |
| 사이드패널 고정 폭이 너무 좁을 경우 (<340px) Hero 레이아웃 깨짐 | `min-width: 340px`, 그 이하에서는 Hero 세로 스택 |
| 기존 `inline style` 코드 대량 삭제로 인한 회귀 | 컴포넌트별 스냅샷 + 수동 테스트 (체크리스트 참조) |
| 모션이 저사양 기기에서 버벅임 | `prefers-reduced-motion` 대응 |

## 10. Test Plan

### 수동 체크리스트

- [ ] Hero 점수 0 → 타깃 값으로 600ms 카운트업
- [ ] Hero verdict 라벨이 `NEVER/CAUTION/OK/UNKNOWN` 에 맞게 매핑
- [ ] CarStrip 에 제조사 · 모델 · 연식 · 주행 · 가격 전부 표시
- [ ] TabBar 탭 전환 시 컨텐츠 fade
- [ ] HealthRadar 5축 모두 카테고리 매핑, 축 점수 < 50% 축 라벨이 적색
- [ ] HealthRadar polygon draw-in 애니메이션
- [ ] FilterTabs 5탭 카운트 정확 (killers/warns/passes/unknowns)
- [ ] FilterTabs 클릭 시 RuleGroups 필터링
- [ ] RuleGroups 카테고리 순서: 차량상태 → 이력 → 사고 → 가격 → 투명성
- [ ] RuleCard killer 배경 적색, warn 옐로우, pass 흰
- [ ] RuleCard stagger 애니메이션 (각 50ms)
- [ ] ACK 버튼이 killer 이면서 acknowledgeable 한 경우에만 표시, 클릭 시 confirm 후 ACK_RULE 전송
- [ ] ActionBar 재평가 → refresh 플로우 정상
- [ ] ActionBar AI 평가 → 탭 전환
- [ ] LoadingView/EmptyState/ErrorView 브루탈 스킨 적용
- [ ] `prefers-reduced-motion: reduce` 활성 시 모든 모션 비활성화
- [ ] Chrome 사이드패널 폭 340px 이상에서 레이아웃 깨짐 없음

### 단위 테스트 (선택)

- `HealthRadar` 카테고리 점수 계산 로직: `computeRadarAxes(results): { category, pct, total, pass }[]`
- `useCountUp`: 지정 시간 내 타깃 값 도달
- verdict → 라벨 매핑 함수

## 11. Build Sequence

1. `theme.ts` — 색/폰트/globalCss 상수
2. `hooks/useCarData.ts` — 기존 App.tsx 메시징 로직 이관, 리그레션 검증
3. `hooks/useCountUp.ts` — 독립 훅
4. `components/EmptyState.tsx`, `LoadingView.tsx`, `ErrorView.tsx` — 의존성 없는 것부터
5. `components/CarStrip.tsx`, `Hero.tsx` — 상단 블록
6. `components/TabBar.tsx`
7. `components/HealthRadar.tsx`
8. `components/FilterTabs.tsx`
9. `components/RuleCard.tsx`, `RuleGroup.tsx`
10. `components/ActionBar.tsx`
11. `App.tsx` 재작성 — 모든 조각 조립
12. 기존 `App.tsx` 900줄 로직 완전 삭제 확인
13. 수동 체크리스트 (§10) 통과

각 단계 완료 후 커밋. TDD 가능한 부분(계산 로직, 훅)은 테스트 먼저.

## 12. References

- 기존 App 코드: `src/sidepanel/App.tsx`
- 룰 메타: `src/sidepanel/rule-meta.ts`
- 룰 타입: `src/core/types/RuleTypes.ts`
- 캐시/메시징: `src/core/storage/db.ts`, `src/core/messaging/protocol.ts`
- 디자인 모형 (브라우저): `.superpowers/brainstorm/*/content/brutalist-v5.html`
