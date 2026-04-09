# daksin-car — Claude Code Guide

Chrome 확장: 엔카 매물 자동 평가 사이드패널.

## 프로젝트 레이아웃

- `src/sidepanel/` — 사이드패널 React UI
- `src/background/` — 서비스워커, 메시지 라우팅, 데이터 수집
- `src/content/` — 엔카 페이지 주입 스크립트
- `src/core/` — 순수 로직 (규칙 엔진, 파서, 타입, 저장소, 메시징, AI 평가, LLM 클라이언트)
- `tests/` — 단위 및 통합 테스트
- `docs/superpowers/specs/` — 설계 스펙 (브레인스토밍 산출물)

## 활성 설계 스펙

코드 변경 전 관련 스펙을 참고할 것:

- **[사이드패널 UX 개편 — Brutalist Scoreboard (2026-04-09)](docs/superpowers/specs/2026-04-09-sidepanel-brutalist-redesign.md)** — 사이드패널 전면 재작성. 점수/레이더/룰 리스트를 Archivo Black + 형광 옐로우 기반 브루탈리즘 스코어보드로 통합. 데이터 모델 변경 없이 `src/sidepanel/**` 만 개편.

## 개발 원칙

- 규칙/타입/메시징 계층은 건드리지 않고 UI 개편 가능
- 파일당 200 LOC 이하 유지 (특히 `src/sidepanel/`)
- Inline `style={{...}}` 보다 컴포넌트별 CSS 문자열 + className 선호
- CSS-in-JS 라이브러리 도입 금지 (번들 무게)
- 모션은 `prefers-reduced-motion: reduce` 존중

## 테스트

- `npm test` — vitest 단위/통합
- 사이드패널 수동 검증: 체크리스트는 각 스펙 §10 참조
