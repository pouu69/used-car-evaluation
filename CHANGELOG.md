# Changelog

## [0.3.0] — 2026-04-12

### Features

- **홈 페이지** — 엔카 매물 외 페이지에서 브랜딩 홈 + MY LIST 탭 표시 (`0b213e1`)
  - CSS로 그린 브루탈리스트 자동차 일러스트
  - "시작하기" 버튼 → fem.encar.com 새 탭 오픈
  - 3단계 사용 가이드
  - MY LIST 탭에서 저장 차량 목록 조회 + 엔카 페이지 이동
- **R12 누유 룰** — 성능점검 inners[] 트리에서 누유(코드 6/7) 감지, warn 표시 (`2075b7d`)
- **저장 10개 제한** — 저장 차량 최대 10대, 초과 시 차단 + 카운터 UI (`8344b02`)

### Changes

- R04 제목을 "프레임 무사고" → "프레임/외판"으로 변경, 외부패널 수리 내역 표시
- manifest version `0.3.0` 동기화, description "12 룰" 반영
- "11 RULES" → "12 RULES" 표기 수정 (TabBar, EmptyState, CLAUDE.md)
- CAUTION 판정 임계값 warn 1개 → 2개 이상으로 상향 (`a2886f8`)
  - warn 1개는 OK 판정 (룰 카드에서 warn 뱃지는 유지)

### UI

- SavedCard 게이지 바 제거, K/W → "치명/주의" 한글 표기 (`85cfef1`)
- SavedCard 치명/주의 좌측 + 버튼 우측 한 줄 배치
- MyList에서 현재 live 차량 클릭 시 무시 (이미 보고 있는 경우)

### Refactoring

- 메시지 핸들러를 `background/handlers.ts`로 분리 — 디스패치 맵 패턴 (SRP)
- 저장 상태/로직을 `useSavedCars` 훅으로 추출 (SRP)
- 룰 매직 넘버를 명명 상수로 교체 (Clean Code)
- EmptyState → 홈 페이지 컴포넌트로 전환, SavedList CSS 중복 제거

## [0.2.0] — 2026-04-11

### Features

- **저장 & 비교** — 관심 차량 저장(IndexedDB) + 최대 4대 비교 모드 (`9f3aa0d`)
- **AI 평가 탭** — Gemini/OpenAI 기반 LLM 차량 리뷰 (`0464a8b`, `542922a`)
- **보험이력 공백기간(R08)** — 월 단위 계산 + 메시지 개선 (`85ee6a8`)
- **보험처리 규모(R10)** — 구간별 메시지 + 자차/대물 분리 (`51c307b`)
- **성능점검 연동(R04)** — 성능점검 데이터로 프레임 판정 보강 (`ab43031`)
- **R03 보너스 전용** — 엔카진단 없으면 null 반환 (`ab43031`)
- **R06 세부 카운트** — 전손/침수/도난 개별 건수 표시 (`ab43031`)
- **개인매물 지원** — 개인/딜러 구분 + 멀티소스 병합 (`c0d5950`)

### UI

- **브루탈리스트 스코어보드** — Archivo Black + 형광 노란색 사이드패널 전면 리디자인
  - Hero, CarStrip, TabBar, HealthRadar, FilterTabs, RuleCard 등 컴포넌트 (`9069e9d`)
  - Loading, Empty, Error 뷰 (`e047ace`)
  - 테마 상수 + globalCss (`82ed8fa`)
- 레이더 차트 대각선 해칭 + 너비 제한 (`af7d30f`, `da78721`)
- 저장 차량 조회 시 AI 탭 비활성화 (`0c9cff7`)
- 저장 버튼 표시 차량과 동기화 (`1bde93a`)
- MyList 탭 전환 시 조회 상태 유지 (`6c09e93`)
- 엔카 링크 버튼 hover 색상 수정 (`16f579b`)

### Refactoring

- 저장 & 비교 코드 단순화 (`020b9bd`)
- 사이드패널 뷰 모드 상태머신 재설계 (`7e009a7`)
- useCarData 리스너 누수 수정 + AiEvaluationPanel 분리 (`197f217`)
- 공유 파서, 메시지, URL, LLM 유틸리티 추출 (`59ffe66`)
- 컨테이너 CSS 공유, percent 헬퍼 추출, LLM 옵션 그룹화 (`a2acec1`)
- fetch 통합, 타입 중복 제거, dev 로거 추가 (`3c21487`)

### Chores

- 미사용 storage/cookies 퍼미션 제거 (`5af753c`)
- Chrome Web Store 패키징 + 제출 문서 (`84c6e5a`)
- 앱 아이콘 생성 (`de85b58`, `44be439`)

## [0.1.0] — 2026-04-05

### Features

- **4계층 도메인 모델** — Collector → Parser → Bridge → Rules 파이프라인 (`2c399e6`)
- **MV3 확장 쉘** — background, content scripts, side panel (`87fbf7b`)
- **Encar API 파서** — 기본 정보, 보험이력, 진단, 성능점검 파싱
- **11개 규칙 엔진** — R01–R11 결정론적 체크리스트 + 점수 산정

### Tests

- 파서 단위 테스트 + 브릿지 통합 픽스처 (`a020845`)
- R03 보너스 전용 + R06 세부 카운트 테스트 (`4838bb8`)
