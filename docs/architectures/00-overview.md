# AutoVerdict — 아키텍처 개요

## 프로젝트 요약

Chrome 확장(Manifest V3)으로, 엔카(fem.encar.com) 중고차 매물 페이지를 자동 평가한다.
사용자가 매물 상세 페이지에 진입하면 페이지 데이터 + 3개 API를 자동 수집하고,
11개 규칙 체크리스트 엔진으로 판정(NEVER / CAUTION / OK / UNKNOWN)과 0–100 점수를 산출하며,
선택적으로 LLM(OpenAI / Gemini)에 보내 자연어 자문을 생성한다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| 언어 | TypeScript |
| UI | React 18 |
| 빌드 | Vite + @crxjs/vite-plugin |
| 저장소 | Dexie (IndexedDB) |
| 검증 | Zod |
| 테스트 | Vitest |

## 디렉토리 구조

```
src/
  manifest.ts               — Chrome 확장 매니페스트
  background/
    index.ts                — 서비스워커 (메시지 핸들링, 오케스트레이션)
    main-world-collector.ts — MAIN world 주입 함수 (API fetch)
  content/
    fem-encar/
      main-world.ts         — MAIN world 콘텐츠 스크립트
      index.ts              — ISOLATED world 콘텐츠 스크립트
  core/
    types/                  — FieldStatus, ParsedData, ChecklistFacts, RuleTypes
    parsers/                — 엔카 JSON/상태 파서
    bridge/                 — EncarParsedData → ChecklistFacts 변환
    collectors/             — 소스 레지스트리, 다중 소스 병합
    rules/                  — R01–R11 규칙 함수 + evaluate()
    evaluation/             — LLM 평가 프롬프트 + 실행
    llm/                    — OpenAI/Gemini 클라이언트
    storage/                — IndexedDB (Dexie)
    messaging/              — 메시지 프로토콜 타입
    encar/                  — URL 유틸
    log.ts                  — 개발 전용 로거
  sidepanel/
    App.tsx                 — 루트 컴포넌트
    AiEvaluationPanel.tsx   — AI 평가 탭
    components/             — UI 컴포넌트
    hooks/                  — useCarData, useCountUp
    lib/                    — verdict, radar, percent 유틸
    theme.ts                — 색상, 폰트, CSS
    rule-meta.ts            — 규칙별 아이콘/카테고리/제목 메타
tests/                      — Vitest 테스트 + 픽스처
```

## 4-Layer 파이프라인

전체 아키텍처는 단방향 계층 구조를 따른다. 각 계층은 바로 아래 계층의 출력만 소비하며, 상위 호출이나 계층 건너뛰기는 없다.

```
COLLECTOR (content scripts + background)
   ↓  raw JSON / page state + httpStatus
PARSER (src/core/parsers/)
   ↓  EncarParsedData (FieldStatus<T> per field)
BRIDGE (src/core/bridge/)
   ↓  ChecklistFacts (site-agnostic, FieldStatus<T> per fact)
RULES (src/core/rules/)
   ↓  RuleReport { verdict, score, results[], killers[], warns[] }
SIDEPANEL UI (React)
```

## End-to-End 데이터 흐름

```
1. 사용자가 https://fem.encar.com/cars/detail/{carId} 진입

2. MAIN WORLD 콘텐츠 스크립트 자동 실행:
   → __PRELOADED_STATE__ 에서 vehicleId/vehicleNo 추출
   → api.encar.com 3개 엔드포인트 병렬 fetch (7초 타임아웃)
   → window.postMessage 로 결과 전달

3. ISOLATED 콘텐츠 스크립트가 postMessage 수신:
   → chrome.runtime.sendMessage 로 COLLECT_REQUEST 전송

4. 백그라운드 서비스워커:
   → IndexedDB 캐시 확인 (hit → bridge+rules 재실행 후 즉시 반환)
   → miss → orchestrate() → encarToFacts() → evaluate()
   → IndexedDB 캐시 저장 (24시간 TTL)
   → COLLECT_RESULT 전송

5. 사이드패널 useCarData 훅이 COLLECT_RESULT 수신:
   → React 렌더링: Hero(점수/판정), CarStrip, HealthRadar, RuleCards

6. 사용자가 "AI 평가" 탭 선택:
   → API 키 입력 (메모리 전용, 비저장)
   → LLM 호출 → Zod 스키마 검증 → 결과 표시
```

## 핵심 설계 원칙

1. **`FieldStatus<T>` 전방위 적용** — 값 부재 이유가 `undefined`가 아닌 타입으로 표현됨
2. **MAIN world 주입으로 CORS 해결** — 엔카 도메인 컨텍스트에서 API 호출
3. **읽기 시 bridge+rules 재실행** — 캐시에는 `parsed`만 신뢰, 규칙 변경이 즉시 반영
4. **API 키 메모리 전용** — IndexedDB/storage/localStorage에 절대 저장하지 않음
5. **개인 매물 분기** — R03 자동 스킵, R04 unknown 처리로 부당한 감점 방지

## 관련 문서

- [01-type-system.md](./01-type-system.md) — FieldStatus 및 타입 시스템
- [02-collectors.md](./02-collectors.md) — 데이터 수집 계층
- [03-parsers.md](./03-parsers.md) — 파서 계층
- [04-bridge.md](./04-bridge.md) — 브릿지 계층
- [05-rules-engine.md](./05-rules-engine.md) — 규칙 엔진
- [06-llm-evaluation.md](./06-llm-evaluation.md) — LLM 평가
- [07-storage.md](./07-storage.md) — 저장소
- [08-messaging.md](./08-messaging.md) — 메시징 프로토콜
- [09-sidepanel-ui.md](./09-sidepanel-ui.md) — 사이드패널 UI
- [10-background.md](./10-background.md) — 백그라운드 서비스워커
