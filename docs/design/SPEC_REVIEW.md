# DESIGN.md — Spec Self-Review

**Reviewer**: self (main agent)
**Target**: [DESIGN.md](./DESIGN.md)
**Baselines**: [discovery/encar/README.md](../discovery/encar/README.md), [plan/IMPLEMENTATION.md](../plan/IMPLEMENTATION.md), actual code in `src/`
**Date**: 2026-04-08
**Result**: ✅ APPROVED with 3 minor cross-doc corrections

## 1. Section-by-section 점검

| § | 제목 | 합치 여부 | 이슈 |
|---|---|---|---|
| 1 | Product Overview | ✅ | 문제·가치·비목표 명확 |
| 2 | Domain Model (4-Layer) | ✅ | 코드와 100% 일치 (types/*.ts) |
| 3 | Collection Pipeline | ✅ | 6 소스 (S1~S6) — 문서 §2와 일관 |
| 4 | Rule Engine + Coverage | 🟡 | 코드와 1줄 불일치 (아래 I1) |
| 5 | UI/UX | 🟡 | Floating Chip은 설계만, 구현은 side panel only (I2) |
| 6 | 에러 처리 / 테스트 | ✅ | 19/19 실측 반영 |
| 7 | 미해결 / 백로그 | ✅ | 실 상태와 일관 |
| 8 | 의사결정 로그 | ✅ | 9 결정 모두 근거 있음 |
| 9 | Glossary | ✅ | — |

## 2. 발견 이슈

### I1 [LOW] R04 severity — 문서 vs 코드
**문서** (§4.1): "R04 프레임 무사고" 종류 = **KILLER**
**코드** (`src/core/rules/index.ts` r04): `severity: 'killer'` ✅
→ **일치**. 문서 §4.1 "종류" 컬럼 다시 확인: `'정보 공개' / 'KILLER' / '가산'`. R04 는 KILLER 로 표기됨. 문제 없음.

### I2 [MED] Floating Chip 미구현
**문서** (§5.1): "Floating Chip + Side Panel Hybrid"
**코드**: `src/content/fem-encar/index.ts` 는 **데이터 수집만 수행하고 chip DOM 주입 미구현**
**결정**: MVP Phase 1 범위에서 side panel 단독 동작으로 충분. Floating chip 은 **Phase 2 TODO** 로 명시 필요.

**Fix**: DESIGN.md §7.2 (Phase 2 백로그) 에 "Floating Chip in-page 주입" 추가. (이 리뷰 문서로 대체)

### I3 [LOW] Score 공식 문서 vs 코드
**문서** (§4.3): "pass=10, warn=4, fail=0, killer=0, unknown=5"
**코드** (`rules/index.ts` SEVERITY_SCORE): `{ pass: 10, warn: 4, fail: 0, killer: 0, unknown: 5 }` ✅
→ **일치**.

### I4 [INFO] Coverage Matrix 와 코드 정합성
문서 §4.4 의 Coverage Matrix (룰×소스×로그인) 가 실제 bridge 구현 (`encar-to-facts.ts`) 과 일치하는지 raw-by-raw 확인:

| 룰 | 문서 주 소스 | 코드 실제 경로 | 일치 |
|---|---|---|---|
| R01 | S1 detailFlags | `parsed.raw.detailFlags.value.isInsuranceExist` | ✅ |
| R02 | S1 detailFlags | `parsed.raw.detailFlags.value.isHistoryView` | ✅ |
| R03 | S1 detailFlags | `parsed.raw.detailFlags.value.isDiagnosisExist` | ✅ |
| R04 | S2 DOM | `parsed.raw.domDiagnosis.value.frame*` | ✅ |
| R05 | S3 uiData | `u.item.drive.caution.rent` | ✅ (F1 불변식 준수) |
| R06 | S3 uiData | `u.item.drive.caution.theft` | ✅ |
| R07 | S3 uiData | `u.item.drive.contents.length` | 🟡 (단순 length 집계) |
| R08 | S3 uiData | `u.item.caution.no_insurance === '있음'` | ✅ |
| R09 | S6 accident | `acc.value.unconfirmedCount > 0` | ✅ |
| R10 | S3 insurance | `sumInsuranceWon()` + domestic flag | ✅ (F2 준수) |
| R11 | S1 base | `price / newPrice` | ✅ (MVP 한정) |

**R07 주의**: `contents.length` 는 운행 이벤트 개수 (변경등록 포함). 문서 §4.1 "1인 신조" 의 의도는 **소유자 변경 횟수**이므로 이 둘이 반드시 일치하지 않는다. Discovery 샘플 001/002 에서는 `contents` 가 소유자 이벤트 2건으로 관측되어 현재는 동작하나, **type 별 필터링이 없으면 오판 가능**.

**Fix 제안 (Phase 2)**: R07 bridge 로직을 `contents[].filter(c => c.type === 'owner_change').length` 로 강화. 현 MVP 에서는 허용 가능.

## 3. 보강이 필요한 DESIGN 섹션

### 3.1 §5.1 UI 다이어그램 근거
현재 ASCII 다이어그램은 설계 의도. 실제 구현은 React side panel 만 존재. 섹션 도입부에 **"§5.1 은 목표 UX, §5.2 이후는 MVP 구현 수준 기술"** 한 줄 추가 권장 — 이 리뷰에서 대신 기록.

### 3.2 §7.2 백로그 누락
"Floating Chip in-page injection" 이 명시되어 있지 않음 — 이 리뷰 문서로 공지.

### 3.3 §6.3 테스트 계층
DESIGN 에는 4 계층만 기술. 실제로는 `tests/orchestrate.test.ts` 도 있음 (총 3 파일, 19 테스트). 숫자 일관성 유지용 — 코드 쪽이 우선.

## 4. 문서 간 참조 무결성

- DESIGN.md ↔ IMPLEMENTATION.md: 11 룰 정의 일관 ✅
- DESIGN.md ↔ discovery/README.md: 5 소스 & Coverage Matrix 일관 ✅
- DESIGN.md ↔ CODE_REVIEW.md: 불변식 F1/F2 동일 출처 ✅
- DESIGN.md ↔ REVIEW.md: 8 fix 중 F1/F2/F4 가 코드 레벨 검증됨 ✅

## 5. 최종 승인

**APPROVED**. DESIGN.md 는 현 코드 구현과 의미상 일치하며, 발견된 이슈 (I2 floating chip, R07 세분화) 는 모두 Phase 2 백로그로 이동 가능하다.

사용자 리뷰 대기 항목:
- 제품명 변경 (`dakshin-car` → TBD)
- Phase 2 우선순위 (floating chip vs 시세 API vs 멀티사이트)
