# Code Review — MVP Core (Stage 5)

**Date**: 2026-04-08
**Scope**: `src/core/{types,parsers,bridge,rules}` + fixtures + tests
**Target**: AI-free 결정론적 코어 (extension shell 제외)
**Result**: ✅ APPROVED — 17/17 테스트 통과, tsc strict noUncheckedIndexedAccess 통과

## 1. 점검 항목

### 1.1 AI-free 원칙 ✅
- 모든 파서가 정규식 + 라벨 화이트리스트만 사용
- LLM/임베딩 호출 없음, 외부 네트워크 호출 없음 (코어)
- 결정론적: 동일 입력 → 동일 출력

### 1.2 4-Layer 단방향 의존성 ✅
- `rules/index.ts` → `types/ChecklistFacts` 만 import
- `bridge/encar-to-facts.ts` → `types/ParsedData` + `types/ChecklistFacts`
- `parsers/encar/*.ts` → `types/ParsedData` + `types/FieldStatus` + `parsers/utils/text`
- DOM/Dexie 참조 없음 (코어)

### 1.3 FieldStatus 5상태 ✅
- 모든 파서가 `value` / `parse_failed{reason}` 둘 중 하나로 반환
- Bridge 가 `parse_failed` 를 그대로 facts 로 전파 (`unknown` 룰 결과로 변환)
- `loading` / `timeout` / `hidden_by_dealer` 상태는 collector pipeline 측에서 사용 예정 (Phase 5)

### 1.4 Discovery 불변식 (F1~F4 from REVIEW.md)
| Fix | 적용 위치 | 검증 |
|---|---|---|
| F1 법인≠렌트 | `bridge/encar-to-facts.ts:90-96` 주석 + `rent` 플래그 직접 사용 | Sample 004 → R05 PASS 통과 |
| F2 insurance.type 필터 | `bridge/encar-to-facts.ts:21` `if (c.type !== 'insurance') continue` | Sample 002/003/004 R10 정확 동작 |
| F3 dateString loose | 날짜 필드를 string 그대로 전파 (검증 안함) | n/a (negative test 필요 시 추가) |
| F4 login_required 감지 | `parsers/encar/history.ts:21` + `accident-report.ts:14` | Unit test 통과 |

### 1.5 Strict TypeScript ✅
- `noUncheckedIndexedAccess: true` 활성
- `strict: true` 활성
- `tsc --noEmit` 무경고 통과

### 1.6 Immutability ✅
- 파서들은 `const` 객체에 필드 누적 (지역 mutate); 반환 후 외부에서는 read-only
- Bridge 는 새 객체 생성 (`{ ...obj }` 패턴은 불필요한 곳에서 미사용)
- Rule 함수는 순수 — facts 인자 mutate 안 함

## 2. 발견 이슈

### 2.1 [LOW] `bridge/encar-to-facts.ts:50` `warnings` 미사용
`bridgeWarnings: warnings` 로 빈 배열 유지하지만 현재는 push 호출이 없음. Phase 5에서 데이터 결손/충돌 감지 시 채울 예정. 코드는 그대로 두고 TODO 주석 추가는 생략 (계획서에 명시됨).

### 2.2 [LOW] `wonToNumber` vs Bridge 인라인 파서 중복
`utils/text.ts` 의 `wonToNumber` 와 `bridge/encar-to-facts.ts:38` 의 정규식이 둘 다 `^([\d,]+)(만)?원$` 패턴을 처리. **현 시점에서는 의도적**: bridge 는 `c.insurance.partPrice` 등 여러 필드를 합산하면서 inline 처리해야 효율적. wonToNumber 는 텍스트 파서에서 단발성으로 사용 예정. 향후 wonToNumber 로 통일 가능하나 MVP 에서는 보류.

### 2.3 [LOW] `parsers/encar/dom.ts:RX.specialNote` 정규식
`/^특이\s*사항(없음|있음)$/` — 라벨과 값이 붙어있는 케이스만 매칭. Sample 004 raw 에는 `"특이 사항없음"` 으로 라벨/값 사이에 공백 없이 붙어있음. 현재 패턴은 OK.
별도 라인으로 분리되는 케이스는 후속 샘플 발견 시 보강.

### 2.4 [INFO] R11 가격 적정성 — 외부 시세 미연동
신차대비 비율 (`price / newPrice`) 만 사용. 가이드의 "동일 연식 시세 비교" 미구현. Phase 2 백로그.

### 2.5 [INFO] Tests don't cover `loading` / `timeout` / `hidden_by_dealer`
Bridge 가 이 상태들을 만나면 그대로 통과함 (failed 처리). collector pipeline (Phase 5) 구현 시 통합 테스트 추가 예정.

## 3. 보안 점검

- 파서/룰은 외부 입력을 string 으로만 받음 → injection 표면 없음
- DOM 파서는 `innerText` 만 사용 (innerHTML 미사용) → XSS 위험 없음
- 파일 시스템/네트워크 호출 없음 (코어)
- Hardcoded secret 없음

## 4. 테스트 커버리지

```
Test Files  2 passed (2)
     Tests  17 passed (17)
```

| 모듈 | 단위 테스트 | 통합 테스트 |
|---|---|---|
| FieldStatus | (간접) | ✅ |
| text utils | ✅ wonToNumber + splitLines | — |
| parsers/dom | ✅ Sample 004-style | (간접) |
| parsers/inspect-report | ✅ | — |
| parsers/diagnosis-report | ✅ | — |
| parsers/accident-report | ✅ + login_required | — |
| parsers/state | ✅ + parse_failed | — |
| parsers/history | ✅ + login_required | — |
| bridge | (간접) | ✅ 5 fixtures |
| rules engine | (간접) | ✅ 5 fixtures |

**Verdict 정확도**: 4 실 샘플 + 1 합성 샘플 모두 문서 verdict 와 일치
- 001 → NEVER (R05+R08) ✓
- 002 → NEVER (R03+R05+R08) ✓
- 003 → NEVER (R03+R05+R08) + R10 WARN ✓
- 004 → NEVER (R08) + R10 WARN + R05 PASS (법인≠렌트) ✓
- ideal → OK ✓

## 5. 결론

**MVP 코어 (parser/bridge/rule) 승인 — Phase 1 완료**.

남은 Phase (5: collector pipeline / 6: UI / extension shell) 는 별도 작업 단위로 진행. 현 상태에서는:

- ✅ 새 샘플 추가만으로 회귀 테스트 가능
- ✅ 사이트 변경에 대한 격리 (parsers 만 수정)
- ✅ 룰 변경에 대한 격리 (rules 만 수정)
- ✅ 사이트 추가 (kcar 등) 시 새 bridge 만 작성하면 됨

자가 코드리뷰 통과.
