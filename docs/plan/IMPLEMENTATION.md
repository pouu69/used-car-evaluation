# daksin-car — 구현 계획 v1

**Date**: 2026-04-07
**Input**: [docs/discovery/encar/README.md](../discovery/encar/README.md)
**Goal**: Chrome Extension MV3 MVP — 엔카 상세 페이지 자동 평가 (11 룰 닥신 체크리스트, AI-free)

---

## 0. 원칙 (재확인)

- **AI-free 결정론적 파서** — LLM/비전 금지
- **4-Layer Domain Model**: ParsedData → Bridge → ChecklistFacts → RuleEngine
- **FieldStatus<T>** discriminated union (5상태)
- **Killer rule 하드 비토 + 사용자 ack (7일)**
- **IndexedDB 24h 캐시 + export/import 백업**
- **Encar only MVP** (`fem.encar.com` + `car.encar.com`)

## 1. 기술 스택 & 버전

| 레이어 | 선택 | 검증 포인트 |
|---|---|---|
| Build | Vite 6 + **@crxjs/vite-plugin 2.x (beta)** | MV3 + React HMR |
| Runtime | React 19 + TypeScript 5.6 | strict mode |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) | oklch 토큰 |
| State | Zustand 5 (UI), TanStack Query 5 (fetch/cache) | — |
| Storage | Dexie 4 (IndexedDB) | 4 테이블 |
| Validation | Zod 4 | 모든 파싱 경계 |
| Testing | Vitest 2 + @testing-library/react 16 + happy-dom | fixture 기반 |
| Lint | Biome 1 or ESLint 9 + Prettier 3 | — |

> Phase 0에서 `npm create vite` + `@crxjs/vite-plugin` 설치 → 실제 최신 호환 버전 확정.

## 2. 디렉토리 구조

```
daksin-car/
├─ docs/
│  ├─ discovery/encar/README.md          (✅ done)
│  └─ plan/IMPLEMENTATION.md              (this file)
├─ src/
│  ├─ manifest.ts                         # CRXJS manifest definition
│  ├─ background/
│  │  └─ index.ts                         # service worker, cross-origin fetch
│  ├─ content/
│  │  ├─ fem-encar/index.ts               # fem.encar.com/cars/detail injected
│  │  └─ car-encar/index.ts               # car.encar.com/history injected
│  ├─ sidepanel/
│  │  ├─ index.html
│  │  ├─ main.tsx
│  │  └─ App.tsx
│  ├─ popup/ (optional)
│  ├─ core/
│  │  ├─ types/
│  │  │  ├─ FieldStatus.ts                # discriminated union
│  │  │  ├─ ParsedData.ts                 # Layer A (site-specific)
│  │  │  ├─ ChecklistFacts.ts             # Layer B (site-agnostic)
│  │  │  └─ RuleTypes.ts                  # Layer D
│  │  ├─ parsers/
│  │  │  ├─ encar/
│  │  │  │  ├─ index.ts                   # orchestrator
│  │  │  │  ├─ state.ts                   # __PRELOADED_STATE__ extractor
│  │  │  │  ├─ dom.ts                     # DOM fallback
│  │  │  │  ├─ history.ts                 # __NEXT_DATA__ uiData
│  │  │  │  ├─ diagnosis-report.ts        # S4
│  │  │  │  ├─ inspect-report.ts          # S5
│  │  │  │  ├─ accident-report.ts         # S6
│  │  │  │  └─ schemas.ts                 # Zod schemas
│  │  │  └─ utils/
│  │  │     ├─ text.ts                    # innerText split, regex helpers
│  │  │     └─ money.ts                   # "3만원" → 30000
│  │  ├─ bridge/
│  │  │  └─ encar-to-facts.ts             # Layer C
│  │  ├─ rules/
│  │  │  ├─ engine.ts                     # pure evaluator
│  │  │  ├─ r01-insurance-disclosed.ts
│  │  │  ├─ r02-inspection-disclosed.ts
│  │  │  ├─ r03-encar-diagnosis.ts
│  │  │  ├─ r04-frame-intact.ts
│  │  │  ├─ r05-not-rental.ts             # KILLER
│  │  │  ├─ r06-no-total-loss.ts          # KILLER
│  │  │  ├─ r07-single-owner.ts
│  │  │  ├─ r08-no-insurance-gap.ts       # KILLER
│  │  │  ├─ r09-no-unresolved.ts
│  │  │  ├─ r10-minor-accidents.ts
│  │  │  ├─ r11-price-reasonable.ts
│  │  │  └─ index.ts                      # rule registry
│  │  ├─ storage/
│  │  │  ├─ db.ts                         # Dexie schema
│  │  │  ├─ cache.ts                      # 24h TTL
│  │  │  ├─ acks.ts                       # 7d acknowledgments
│  │  │  ├─ saved.ts                      # infinite
│  │  │  └─ settings.ts
│  │  └─ messaging/
│  │     └─ protocol.ts                   # content ↔ bg ↔ sidepanel types
│  ├─ ui/
│  │  ├─ components/
│  │  │  ├─ FloatingChip.tsx              # content script injected
│  │  │  ├─ SidePanelRoot.tsx
│  │  │  ├─ ScoreView.tsx
│  │  │  ├─ RiskSignalsView.tsx           # default landing
│  │  │  ├─ ChecklistView.tsx
│  │  │  ├─ RuleCard.tsx
│  │  │  ├─ FieldStatusBadge.tsx
│  │  │  └─ AckDialog.tsx
│  │  └─ tokens.css                       # Tailwind 4 oklch tokens
│  └─ __fixtures__/
│     ├─ 001-sportage/
│     │  ├─ preloaded-state.json
│     │  ├─ uidata.json
│     │  └─ detail.html
│     ├─ 002-palisade/
│     ├─ 003-palisade-22/
│     └─ 004-bmw-e90/
├─ tests/
│  ├─ parsers/
│  ├─ bridge/
│  ├─ rules/
│  └─ e2e/
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ biome.json
└─ README.md
```

## 3. 타입 기반 (Layer A/B/C/D 고정)

### 3.1 FieldStatus
```typescript
export type FieldStatus<T> =
  | { kind: 'value'; value: T }
  | { kind: 'hidden_by_dealer' }
  | { kind: 'parse_failed'; reason: string }
  | { kind: 'loading' }
  | { kind: 'timeout' };

export const value = <T>(value: T): FieldStatus<T> => ({ kind: 'value', value });
export const hidden = <T>(): FieldStatus<T> => ({ kind: 'hidden_by_dealer' });
export const failed = <T>(reason: string): FieldStatus<T> => ({ kind: 'parse_failed', reason });
```

### 3.2 Layer A — EncarParsedData
```typescript
export interface EncarParsedData {
  schemaVersion: 1;
  source: 'encar';
  url: string;
  carId: string;
  fetchedAt: number;
  loginState: 'logged_in' | 'logged_out' | 'unknown';
  raw: {
    base: FieldStatus<EncarCarBase>;
    detailFlags: FieldStatus<DetailFlags>;
    domDiagnosis: FieldStatus<DomDiagnosis>;
    uiData: FieldStatus<UiData>;
    diagnosisReport: FieldStatus<DiagnosisReport>;
    inspectReport: FieldStatus<InspectReport>;
    accidentReport: FieldStatus<AccidentReport>;
  };
}
```

### 3.3 Layer B — ChecklistFacts (site-agnostic)
```typescript
export interface ChecklistFacts {
  schemaVersion: 1;
  derivedFrom: 'encar' | 'kcar' | 'manual';
  bridgeWarnings: string[];
  insuranceHistoryDisclosed: FieldStatus<boolean>;      // R01
  inspectionReportDisclosed: FieldStatus<boolean>;      // R02
  hasEncarDiagnosis: FieldStatus<boolean>;              // R03
  frameDamage: FieldStatus<{ hasDamage: boolean; parts?: string[] }>; // R04
  usageHistory: FieldStatus<{ rental: boolean; taxi: boolean; business: boolean }>; // R05
  totalLossHistory: FieldStatus<boolean>;               // R06
  ownerChangeCount: FieldStatus<number>;                // R07
  insuranceGap: FieldStatus<boolean>;                   // R08
  unconfirmedAccident: FieldStatus<boolean>;            // R09
  minorAccidents: FieldStatus<{ ownDamageWon: number; otherDamageWon: number; domestic: boolean }>; // R10
  priceVsMarket: FieldStatus<{ priceWon: number; newPriceWon: number; ratio: number }>; // R11
}
```

### 3.4 Layer D — Rule
```typescript
export type Severity = 'pass' | 'warn' | 'fail' | 'killer' | 'unknown';

export interface RuleResult {
  ruleId: string;                  // 'R05'
  title: string;                   // '렌트/택시 이력 없음'
  severity: Severity;
  message: string;                 // user-facing
  evidence: Array<{ field: string; value: unknown }>;
  acknowledgeable: boolean;        // killer 여부
}

export type Rule = (facts: ChecklistFacts) => RuleResult;
```

## 4. 수집 파이프라인 상태머신

```
User opens fem.encar.com/cars/detail/{id}
       │
       ▼
[1] Content script detects URL → extract carId
       │
       ▼
[2] Check IndexedDB cache (24h)
       │  hit → emit to sidepanel
       │  miss ↓
       ▼
[3] Collect S1 (__PRELOADED_STATE__) + S2 (DOM)      [in-page]
       │
       ▼
[4] Send to background: { carId, parsedA1, parsedA2 }
       │
       ▼
[5] Background fetch in parallel with credentials:
      - S3 car.encar.com/history?carId
      - S4 fem.encar.com/cars/report/diagnosis/{id}
      - S5 fem.encar.com/cars/report/inspect/{id}
      - S6 fem.encar.com/cars/report/accident/{id}
       │
       ▼
[6] Each fetch result:
      - ok     → parse → FieldStatus.value
      - 401/redirect to login → FieldStatus.parse_failed('login_required')
      - 500 / missing uiData → FieldStatus.parse_failed('unavailable')
      - network err → FieldStatus.timeout
       │
       ▼
[7] Merge into EncarParsedData → Bridge → ChecklistFacts
       │
       ▼
[8] RuleEngine.evaluate(facts) → RuleResult[]
       │
       ▼
[9] Persist to IndexedDB cache (ttl 24h)
       │
       ▼
[10] Emit to side panel via chrome.runtime messages
```

### 4.1 타임아웃 정책
- 각 S3~S6 fetch: 8초 개별 타임아웃
- 전체 수집: 15초 hard limit → 부분 결과로 진행

### 4.2 수동 재수집
- Floating chip "↻ 재평가" 버튼 → cache invalidate + 위 [3]부터 재시작

## 5. Rule Engine

```typescript
// rules/engine.ts
export function evaluate(facts: ChecklistFacts, registry: Rule[]): RuleReport {
  const results = registry.map(rule => rule(facts));
  const killers = results.filter(r => r.severity === 'killer');
  const warns = results.filter(r => r.severity === 'warn');
  const verdict: 'NEVER' | 'CAUTION' | 'OK' | 'UNKNOWN' =
    killers.length > 0 ? 'NEVER'
    : warns.length > 0 ? 'CAUTION'
    : results.some(r => r.severity === 'unknown') ? 'UNKNOWN'
    : 'OK';
  const score = computeScore(results);
  return { verdict, score, results, killers, warns };
}
```

순수 함수. `facts` 만 의존. DOM/fetch/Dexie 절대 참조 금지 → Vitest 단위 테스트로 100% 커버.

## 6. UI (Floating Chip + Side Panel Hybrid)

### 6.1 Floating Chip (in-page, content script)
- 오른쪽 하단 고정
- `verdict` 아이콘 + 점수 + 클릭 → side panel 열기
- loading / logged_out / ok / caution / never 5 상태 시각화

### 6.2 Side Panel
- **Tab 1: 위험 신호** (default) — killer/warn 만 카드 형태로 노출 + "이 경고 인정 (7일)" 버튼
- **Tab 2: 스코어** — 원형 게이지 + 세부 점수
- **Tab 3: 체크리스트** — 11개 룰 전체 표
- **Tab 4: 원본 데이터** — 디버그용 (개발 모드)

### 6.3 Acknowledge 시스템
```typescript
interface Ack {
  carId: string;
  ruleId: string;
  ackedAt: number;                 // epoch ms
  expiresAt: number;               // +7d
}
```
killer 룰이 ack 되면 `verdict` 계산에서 제외. UI 에는 "사용자가 무시함" 배지 표시.

## 7. Storage (Dexie)

```typescript
// core/storage/db.ts
import Dexie, { Table } from 'dexie';

export interface CacheRow {
  carId: string;
  url: string;
  parsedData: EncarParsedData;
  facts: ChecklistFacts;
  report: RuleReport;
  cachedAt: number;
  expiresAt: number;
}

export class DaksinDB extends Dexie {
  cache!: Table<CacheRow, string>;
  acks!: Table<Ack, [string, string]>;
  saved!: Table<SavedRow, string>;
  settings!: Table<SettingRow, string>;
  constructor() {
    super('daksin-car');
    this.version(1).stores({
      cache: 'carId, cachedAt, expiresAt',
      acks: '[carId+ruleId], expiresAt',
      saved: 'carId, savedAt',
      settings: 'key',
    });
  }
}
```

Retention sweeper: background alarm 1회/일 → `expiresAt < now()` 행 삭제.

Export/Import: JSON dump of all tables.

## 8. Messaging 프로토콜

```typescript
// core/messaging/protocol.ts
export type Message =
  | { type: 'COLLECT_REQUEST'; carId: string; url: string; inPageData: InPageData }
  | { type: 'COLLECT_PROGRESS'; carId: string; stage: string; fieldStatus: Record<string, string> }
  | { type: 'COLLECT_RESULT'; carId: string; report: RuleReport }
  | { type: 'COLLECT_ERROR'; carId: string; reason: string }
  | { type: 'ACK_RULE'; carId: string; ruleId: string }
  | { type: 'REFRESH'; carId: string };
```

## 9. 테스팅 전략

### 9.1 Fixture 기반 단위 테스트
- 4 샘플의 `__PRELOADED_STATE__` JSON + `__NEXT_DATA__` JSON + DOM snapshot HTML 을 `src/__fixtures__/` 에 저장
- 각 파서는 fixture 입력 → 예상 ParsedData 출력 snapshot 비교
- Bridge: ParsedData → ChecklistFacts snapshot
- Rule engine: ChecklistFacts → RuleReport snapshot (4 샘플의 정답 verdict 기록 — 001 NEVER R05+R08, 002 NEVER R03+R05+R08, 003 NEVER R03+R05+R08+R10 WARN, 004 NEVER R08 + R10 WARN)

### 9.2 테스트 계층
1. **파서 단위** — 각 파서 함수 ≥ 90% 라인 커버
2. **Bridge 단위** — FieldStatus 전파 검증
3. **RuleEngine 단위** — 각 룰 pass/warn/fail/killer 경로
4. **통합** — 4 샘플 전체 파이프라인 end-to-end
5. **컴포넌트** — Side panel 렌더링 (RTL)
6. **E2E** — (선택) Playwright + dist 로드 테스트 (Phase 2)

### 9.3 커버리지 목표
- core/ ≥ 85%
- rules/ = 100%
- parsers/ ≥ 80% (DOM 엣지케이스)

## 10. 실행 단계 (Phase Breakdown)

### Phase 1 — Bootstrap (Stage 4a)
1. `npm create vite@latest daksin-car -- --template react-ts`
2. `@crxjs/vite-plugin` + `@tailwindcss/vite` + dexie + zod + vitest 설치
3. `manifest.ts` 작성 (host_permissions 2 도메인, side_panel, background worker)
4. Vitest + happy-dom 설정
5. **Verify**: `npm run build` 성공, `dist/` 에 MV3 아티팩트 생성

### Phase 2 — Core Types & Schemas (Stage 4b)
1. `core/types/*` 작성
2. `core/parsers/encar/schemas.ts` Zod 스키마 (observed schema 기반)
3. **Verify**: tsc strict 통과

### Phase 3 — Parsers (Stage 4c) — **fixture-driven**
1. Fixture JSON/HTML 을 4 샘플에서 추출 (이미 수집한 데이터 복원)
2. `state.ts`, `history.ts`, `dom.ts`, `diagnosis-report.ts`, `inspect-report.ts` 구현
3. **Verify**: fixture 테스트 전부 녹색

### Phase 4 — Bridge + Rule Engine (Stage 4d)
1. `bridge/encar-to-facts.ts`
2. `rules/r01..r11` + engine
3. **Verify**: 4 샘플 verdict 가 문서와 일치

### Phase 5 — Storage + Messaging (Stage 4e)
1. Dexie schema + cache/acks/saved/settings
2. 백그라운드 service worker + fetch orchestrator
3. Content script 주입
4. **Verify**: chrome.storage mock 기반 DB 왕복 테스트

### Phase 6 — UI (Stage 4f)
1. FloatingChip + SidePanel shell
2. 3 탭 뷰 (위험신호 default)
3. Ack 다이얼로그
4. **Verify**: React Testing Library snapshot

### Phase 7 — Integration smoke (Stage 6)
1. `pnpm build` → Chrome `chrome://extensions` load unpacked
2. 4 샘플 URL 방문 → 수집 → verdict 일치 확인
3. 오프라인 / 로그인 해제 / 500 에러 시뮬레이션

## 11. 리스크 & 미해결

- **@crxjs/vite-plugin 2.x 는 beta** — 릴리즈 노트에서 React 19 호환 확인 필요. 실패 시 `vite-plugin-web-extension` 대체.
- **Tailwind 4 oklch** — 구형 Chrome (< 111) 미지원. `host_permissions` 상 최신만 대상.
- **로그인 상태 쿠키 이름** 미확정 — Phase 5 에서 실브라우저 확인 필요.
- **S3~S6 fetch 가 CORS 우회 가능한지** — service worker 에서 `credentials: include` + host_permissions 로 허용됨을 Phase 1 에 검증.
- **긍정 PASS 샘플 부재** — Rule engine 단위 테스트용 **합성 fixture** (artificial ideal case) 작성 필요.

## 12. 완료 조건 (MVP DoD)

- [ ] `pnpm build` 성공, dist/ 가 Chrome 에서 정상 로드
- [ ] 4 샘플 URL 에서 문서와 일치하는 verdict 출력
- [ ] 킬러 룰 ack 7일 동작 (시간 모킹 테스트)
- [ ] Export/Import 라운드트립 무결성 테스트 통과
- [ ] core 커버리지 ≥ 85%, rules 100%
- [ ] 로그인 미상태에서 부분 결과 + CTA 노출
- [ ] README 에 install/개발 가이드 포함
