# 규칙 엔진

> `src/core/rules/index.ts`

순수 함수로 구성되며 I/O나 사이드 이펙트가 없다. 각 규칙은 `(facts: ChecklistFacts) => RuleResult | null` 시그니처를 따른다.

`null` 반환 = "해당 없음" — 결과에서 완전히 제외된다 (R03 진단 없음, R11 신차가 없음).

---

## 개별 규칙

### R01 — 보험이력 공개

| 조건 | Severity |
|------|----------|
| 공개됨 | `pass` |
| 비공개 | `fail` |

### R02 — 성능점검 공개

| 조건 | Severity |
|------|----------|
| 공개됨 | `pass` |
| 비공개 | `fail` |

### R03 — 엔카진단

| 조건 | Severity |
|------|----------|
| 존재 | `pass` |
| 부재 | **`null`** (제외) |

> 보너스 규칙: 진단이 없다고 감점하지 않고, 있으면 가점.

### R04 — 프레임 무사고

| 조건 | Severity |
|------|----------|
| 무사고 | `pass` |
| 프레임 손상 | **`killer`** |

### R05 — 렌트/택시 이력

| 조건 | Severity |
|------|----------|
| 렌트 또는 택시 | **`killer`** |
| 관용(government)만 | `warn` |
| 없음 | `pass` |

### R06 — 전손/침수/도난

| 조건 | Severity |
|------|----------|
| 어떤 항목이든 > 0 | **`killer`** |
| 모두 0 | `pass` |

### R07 — 소유자 변경

| 조건 | Severity |
|------|----------|
| 2회 이하 | `pass` |
| 3회 이상 | `warn` |

### R08 — 자차보험 공백

| 조건 | Severity |
|------|----------|
| 공백 없음 | `pass` |
| 공백 존재 | `warn` |

### R09 — 수리비 미확정

| 조건 | Severity |
|------|----------|
| 확정 | `pass` |
| 미확정 | `warn` |

### R10 — 보험처리 규모

| 조건 | Severity |
|------|----------|
| 0원 | `pass` |
| 국산 ≤ 200만 / 수입 ≤ 400만 | `pass` |
| 기준 초과 | `warn` |

> 국산/수입 기준이 다르다: `domestic` 플래그로 분기.

### R11 — 가격 적정성

| 조건 | Severity |
|------|----------|
| newPrice 없음 | **`null`** (제외) |
| ratio < 0.45 또는 > 1.15 | `warn` |
| 0.45 ≤ ratio ≤ 1.15 | `pass` |

> 보너스 규칙: 신차가 없으면 평가하지 않음.

---

## evaluate() 함수

```typescript
evaluate(facts: ChecklistFacts, registry = ALL_RULES): RuleReport
```

### 실행 흐름

1. 모든 규칙 실행, `null` 반환 필터링
2. `killers` 추출 (`severity === 'killer'`)
3. `warns` 추출 (`severity === 'warn'`)
4. 판정 결정:

```
killers > 0       → NEVER
warns > 0         → CAUTION
any unknown 존재   → UNKNOWN
그 외              → OK
```

### 점수 계산

각 규칙별 점수 매핑:

| Severity | 점수 |
|----------|------|
| `pass` | 10 |
| `warn` | 4 |
| `fail` | 0 |
| `killer` | 0 |
| `unknown` | 5 |

총점 = `(규칙별 점수 합 / 규칙 수 × 10) × 100` → 0–100 범위로 정규화.

---

## Severity 등급 체계

```
killer  ← 즉시 거래 포기 사유 (프레임 손상, 렌트/택시, 전손/침수/도난)
fail    ← 심각한 문제 (정보 비공개)
warn    ← 주의 필요 (소유자 많음, 보험 공백, 가격 이상 등)
pass    ← 정상
unknown ← 데이터 부족으로 판정 불가
```
