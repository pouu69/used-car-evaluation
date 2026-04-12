# 타입 시스템

## FieldStatus\<T\> — 파이프라인의 기본 단위

> `src/core/types/FieldStatus.ts`

모든 파서 출력 필드는 `T | undefined` 대신 `FieldStatus<T>` 로 감싸진다.
값이 없는 **이유**를 일급 시민으로 다루기 때문에, 규칙 엔진이 "딜러가 숨겼다"와 "API 404"와 "파싱 실패"를 구분하여 적절한 `severity`를 부여할 수 있다.

### 판별 유니온 (Discriminated Union)

```typescript
type FieldStatus<T> =
  | { kind: 'value';            value: T }
  | { kind: 'hidden_by_dealer' }
  | { kind: 'parse_failed';     reason: string }
  | { kind: 'loading' }
  | { kind: 'timeout' }
```

### 헬퍼 함수

| 함수 | 역할 |
|------|------|
| `value(v)` | `{ kind: 'value', value: v }` 생성 |
| `hidden()` | `{ kind: 'hidden_by_dealer' }` 생성 |
| `failed(reason)` | `{ kind: 'parse_failed', reason }` 생성 |
| `loading()` | `{ kind: 'loading' }` 생성 |
| `timeout()` | `{ kind: 'timeout' }` 생성 |
| `isValue(fs)` | 타입 가드 — `kind === 'value'` |
| `mapValue(fs, fn)` | value면 `fn(value)` 적용, 아니면 원본 반환 |
| `getOr(fs, fallback)` | value면 `value`, 아니면 `fallback` 반환 |

---

## ParsedData — Layer A (사이트 종속)

> `src/core/types/ParsedData.ts`

엔카 파서의 출력 타입. 모든 raw 필드가 `FieldStatus<T>`로 감싸져 있다.

```typescript
interface EncarParsedData {
  schemaVersion: 1
  source: 'encar'
  url: string
  carId: string
  vehicleId: string | null
  vehicleNo: string | null
  fetchedAt: number
  loginState: LoginState

  raw: {
    base:          FieldStatus<EncarCarBase>
    detailFlags:   FieldStatus<DetailFlags>
    recordApi:     FieldStatus<RecordApi>
    diagnosisApi:  FieldStatus<DiagnosisApi>
    inspectionApi: FieldStatus<InspectionApi>
  }
}
```

### EncarCarBase 주요 필드

| 그룹 | 필드 |
|------|------|
| `category` | make, model, year, newPrice, domestic |
| `advertisement` | price, preVerified, trust |
| `spec` | mileage, fuel, transmission |
| `condition` | 상태 정보 |
| `contact` | userType (`'CLIENT'` \| `'DEALER'`) |
| `partnership` | 파트너십 정보 |

### DetailFlags

```typescript
interface DetailFlags {
  isInsuranceExist: boolean   // → R01
  isHistoryView: boolean      // → R02
  isDiagnosisExist: boolean   // → R03
  isDealer: boolean           // → 개인/딜러 분기
}
```

---

## ChecklistFacts — Layer B/C (사이트 무관)

> `src/core/types/ChecklistFacts.ts`

규칙 엔진이 소비하는 사이트 독립적 팩트. 브릿지가 `EncarParsedData`에서 변환한다.

| 필드 | 규칙 | 타입 |
|------|------|------|
| `insuranceHistoryDisclosed` | R01 | `FieldStatus<boolean>` |
| `inspectionReportDisclosed` | R02 | `FieldStatus<boolean>` |
| `hasEncarDiagnosis` | R03 | `FieldStatus<boolean>` |
| `frameDamage` | R04 | `FieldStatus<{ hasDamage: boolean; parts? }>` |
| `usageHistory` | R05 | `FieldStatus<{ rental, taxi, business: boolean }>` |
| `totalLossHistory` | R06 | `FieldStatus<{ totalLoss, floodTotal, floodPart, robber: number }>` |
| `ownerChangeCount` | R07 | `FieldStatus<number>` |
| `insuranceGap` | R08 | `FieldStatus<{ hasGap, totalMonths, periods[] }>` |
| `unconfirmedAccident` | R09 | `FieldStatus<boolean>` |
| `minorAccidents` | R10 | `FieldStatus<{ ownDamageWon, otherDamageWon, domestic: boolean }>` |
| `priceVsMarket` | R11 | `FieldStatus<{ priceWon, newPriceWon, ratio: number }>` |

메타 필드: `derivedFrom: 'encar'`, `bridgeWarnings: string[]`

---

## RuleTypes — Layer D

> `src/core/types/RuleTypes.ts`

```typescript
type Severity = 'pass' | 'warn' | 'fail' | 'killer' | 'unknown'
type Verdict  = 'NEVER' | 'CAUTION' | 'OK' | 'UNKNOWN'

type Rule = (facts: ChecklistFacts) => RuleResult | null
// null = 해당 없음 (결과에서 제외)

interface RuleResult {
  ruleId: string
  title: string
  severity: Severity
  message: string
  evidence: string[]
  acknowledgeable: boolean
}

interface RuleReport {
  verdict: Verdict
  score: number          // 0–100
  results: RuleResult[]
  killers: RuleResult[]  // severity === 'killer'
  warns: RuleResult[]    // severity === 'warn'
}
```

## 타입 계층 흐름

```
EncarParsedData (사이트 종속, raw FieldStatus<T>)
       ↓  encarToFacts()
ChecklistFacts (사이트 무관, FieldStatus<T>)
       ↓  evaluate()
RuleReport { verdict, score, results[] }
       ↓  evaluateCar()
CarEvaluation (LLM 자연어 자문)
```
