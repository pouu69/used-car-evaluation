# 사이드패널 UI

> `src/sidepanel/`

React 18 기반 사이드패널. CSS-in-JS 라이브러리 없이 컴포넌트별 CSS 문자열 + className 방식.

---

## 엔트리포인트

### main.tsx

`createRoot`로 `<App />`을 `#root`에 렌더링.

### App.tsx — 루트 컴포넌트

**상태:**
- `tab`: `'checklist' | 'ai'`
- `filter`: `'all' | 'fatal' | 'warn' | 'pass' | 'na'`

**데이터:** `useCarData()` 훅에서 수집 결과 수신.

**렌더 분기:**

| 조건 | 렌더링 |
|------|--------|
| 엔카 상세 페이지 아님 | `<EmptyState />` |
| 로드 에러 | `<ErrorView />` |
| 로딩 중 / stale | `<LoadingView />` |
| 정상 로드 | 전체 UI |

**전체 UI 레이아웃:**

```
<Hero />            — 점수 카운터 + 판정 배지
<CarStrip />        — 제조사/모델/연식/주행거리/가격
<TabBar />          — 체크리스트 | AI 탭 전환
[체크리스트 탭]
  <HealthRadar />   — 5축 SVG 레이더 차트
  <FilterTabs />    — severity 별 필터
  <RuleGroup />*    — 카테고리별 그룹 (차량상태, 이력, 사고, 가격, 투명성)
    <RuleCard />*   — 개별 규칙 결과 카드
  <ActionBar />     — 새로고침 + "AI 평가" 버튼
[AI 탭]
  <AiEvaluationPanel /> — 프로바이더 폼 + 평가 결과
```

---

## 핵심 훅

### useCarData (`hooks/useCarData.ts`)

사이드패널의 중앙 데이터 훅.

**마운트 시 동작:**
1. `chrome.tabs.query`로 활성 탭 조회
2. `GET_LAST` 전송 → 캐시 있으면 즉시 설정
3. 캐시 미스 → `COLLECT_FOR_TAB` 전송으로 백그라운드 수집 트리거
4. `chrome.runtime.onMessage` 리스너 등록:
   - `COLLECT_PROGRESS` → `progressStage` 업데이트
   - `COLLECT_RESULT` → `row` 설정
   - `COLLECT_ERROR` → `loadError` 설정
5. 탭 변경/네비게이션 감지:
   - `chrome.tabs.onActivated` — 탭 전환
   - `chrome.tabs.onUpdated` — URL 변경

**refresh() 메서드:**
```
REFRESH 전송 (캐시 무효화)
  → COLLECT_FOR_TAB 전송
  → 22초 워치독 설정 (타임아웃 시 'watchdog_timeout' 에러)
```

**ack(ruleId) 메서드:**
```
사용자 확인 → ACK_RULE 전송 → 데이터 재로드
```

**반환값:**
```typescript
{
  active: boolean          // 엔카 상세 페이지 여부
  row: CacheRow | null     // 수집 결과
  loading: boolean
  progressStage: string
  loadError: string | null
  refresh: () => void
  ack: (ruleId: string) => void
}
```

### useCountUp (`hooks/useCountUp.ts`)

0에서 목표값까지 애니메이션 카운트업. Hero 점수 표시에 사용.

---

## 컴포넌트 상세

### Hero (`components/Hero.tsx`)

점수 카운터 + 판정 배지 표시.
- `useCountUp`으로 점수 애니메이션
- 판정별 색상/라벨: NEVER(빨강), CAUTION(노랑), OK(초록), UNKNOWN(회색)

### CarStrip (`components/CarStrip.tsx`)

차량 기본 정보 한 줄 요약: 제조사, 모델, 연식, 주행거리, 가격.

### TabBar (`components/TabBar.tsx`)

`체크리스트 | AI` 탭 전환기.

### HealthRadar (`components/HealthRadar.tsx`)

5축 SVG 레이더 차트.
- `lib/radar.ts`의 `computeRadarAxes()`로 카테고리별 pass 비율 계산
- 축 라벨: pass율 < 50%이면 빨강, 아니면 검정
- 데이터 폴리곤: 대각선 노랑/검정 해치 필 + `stroke-dasharray: 2000` 드로우 애니메이션

### FilterTabs (`components/FilterTabs.tsx`)

severity 별 규칙 필터: 전체 / 치명 / 주의 / 통과 / 해당없음.

### RuleGroup (`components/RuleGroup.tsx`)

카테고리 그룹 헤더 + 하위 RuleCard 목록.

카테고리 순서 (`rule-meta.ts`의 `CATEGORY_ORDER`):
1. 차량 상태
2. 이력
3. 사고
4. 가격
5. 투명성

### RuleCard (`components/RuleCard.tsx`)

개별 규칙 결과 카드. severity 아이콘, 제목, 메시지, evidence 표시.

### ActionBar (`components/ActionBar.tsx`)

새로고침 버튼 + "AI 평가" 버튼.

### AI 컴포넌트 (`components/ai/`)

| 컴포넌트 | 역할 |
|----------|------|
| `AiProviderForm` | 프로바이더 선택 (OpenAI/Gemini) + API 키 입력 |
| `EvaluationView` | LLM 결과: verdict, summary, strengths, concerns, negotiation points |
| `ConcernCard` | 개별 concern 항목 카드 |
| `styles.ts` | AI 패널 공통 CSS |

### 상태/에러 컴포넌트

| 컴포넌트 | 표시 조건 |
|----------|-----------|
| `LoadingView` | 로딩 중, progressStage 표시 |
| `EmptyState` | 엔카 상세 페이지가 아닐 때 |
| `ErrorView` | 수집 에러, 재시도 버튼 포함 |

---

## 유틸리티 라이브러리 (`lib/`)

| 파일 | 함수 | 용도 |
|------|------|------|
| `verdict.ts` | `mapVerdictLabel()` | Verdict → 한국어 라벨 |
| `verdict.ts` | `buildVerdictSummary()` | 판정 요약 문자열 생성 |
| `radar.ts` | `computeRadarAxes()` | 카테고리별 pass 비율 → 레이더 축 |
| `percent.ts` | `passRatio()` | pass 비율 계산 |
| `percent.ts` | `getHealthLevel()` | 비율 → 건강 등급 |
| `ruleNumber.ts` | `ruleNumber()` | `"R07"` → `"07"` |

---

## 테마 (`theme.ts`)

| 항목 | 내용 |
|------|------|
| `COLORS` | 판정별 색상, 배경색, 텍스트색 |
| `FONTS` | Archivo Black 등 폰트 설정 |
| `globalCss` | 전역 CSS 문자열 |
| `keyframes` | 애니메이션 키프레임 |

---

## AiEvaluationPanel (`AiEvaluationPanel.tsx`)

AI 탭의 메인 컴포넌트.

**상태:** `provider`, `apiKey` (메모리 전용), `showKey`, `loading`, `error`, `evaluation`

**실행 흐름:**
1. `AbortController`로 취소 지원
2. `runCarEvaluation({ provider, apiKey, input: { parsed, facts, report }, signal })` 호출
3. 에러 분기:
   - `AbortError` → 사용자 취소
   - `LLMError` → 프로바이더 + 상태 코드 표시
   - 일반 `Error` → 메시지 표시
4. 성공 시 `<EvaluationView />` 렌더링
