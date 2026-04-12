# LLM 평가 계층

## LLM 클라이언트

> `src/core/llm/`

### 프로바이더 공통 인터페이스

```typescript
interface LLMClient {
  provider: string
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResult>
}

interface LLMCompletionRequest {
  messages: LLMMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: 'json_object'
  signal?: AbortSignal
}
```

### 공유 베이스 (`base.ts`)

| 함수 | 역할 |
|------|------|
| `validateApiKey()` | 트림, 빈 값/비-ASCII 문자 거부 (한국어 따옴표로 인한 Latin-1 헤더 오류 방지) |
| `assertMessagesNonEmpty()` | 메시지 배열 비어있으면 에러 |
| `fetchLLM(url, init, provider)` | 네트워크 에러, 비-2xx 응답, 비-JSON 바디를 `LLMError`로 정규화 |

### OpenAI 클라이언트 (`openai.ts`)

| 설정 | 값 |
|------|-----|
| 기본 모델 | `gpt-4o-mini` |
| 기본 URL | `https://api.openai.com/v1` |
| JSON 모드 | `response_format: { type: 'json_object' }` |
| 토큰 매핑 | `maxTokens` → `max_tokens` |

### Gemini 클라이언트 (`gemini.ts`)

| 설정 | 값 |
|------|-----|
| 기본 모델 | `gemini-2.5-flash-lite` |
| 기본 URL | `https://generativelanguage.googleapis.com/v1beta` |
| API 키 전송 | `x-goog-api-key` 헤더 (URL 아닌 헤더로 프라이버시 보호) |
| Thinking 비활성화 | `thinkingConfig: { thinkingBudget: 0 }` |

> Gemini 2.5의 thinking 모드를 명시적으로 비활성화한다. 활성 시 출력 토큰 버짓을 숨겨진 사고 과정에 소비하여 실제 JSON 응답이 잘리는 문제를 방지한다.

**MAX_TOKENS 감지:** `finishReason === 'MAX_TOKENS'`를 감지하면 즉시 `LLMError`를 던진다. 이로써 `JSON.parse`에서 "Unterminated string" 같은 혼란스러운 에러 대신 명확한 에러 메시지를 제공한다.

### 팩토리 (`index.ts`)

```typescript
createLLMClient({ provider: 'openai' | 'gemini', apiKey, baseUrl?, defaultModel? })
```

---

## 평가 실행

> `src/core/evaluation/`

### CarEvaluation 스키마 (Zod 검증)

```typescript
interface CarEvaluation {
  verdict: 'BUY' | 'NEGOTIATE' | 'AVOID' | 'UNKNOWN'
  overallRisk: 'low' | 'medium' | 'high' | 'critical'
  summary: string                    // 최대 120자, 1–2문장
  strengths: string[]                // 최대 3개, 각 ≤ 20자
  concerns: EvaluationFinding[]      // title, severity, detail, evidenceRuleIds[]
  negotiationPoints: string[]        // 3–4개 실행 가능 항목
  dataQualityWarnings: string[]      // 최대 3개
  model: string                      // 실제 사용된 모델 ID
  generatedAt: number                // epoch ms
}
```

### 프롬프트 아키텍처 (`prompt.ts`)

**시스템 프롬프트** (`EVALUATION_SYSTEM_PROMPT`):
- 페르소나: 크롤러 베테랑 컨설턴트
- 각 출력 필드별 길이 제한 명시
- 금지 표현 목록: `"것으로 보입니다"`, `"전반적으로"` 등
- 판정 규칙:
  - killers ≥ 1 → `AVOID`
  - warns only → `NEGOTIATE`
  - clean + 충분한 정보 → `BUY`
  - known < 50% → `UNKNOWN`

**유저 프롬프트** (`buildEvaluationUserPrompt`):

토큰 비용 최소화를 위한 압축 구성:
1. `buildCarLine()` — 차량 스펙/가격 한 줄 요약
2. `splitFacts()` — 팩트를 `known`(value) / `unknown`(failed/loading) / `hidden`(hidden_by_dealer)으로 분류
3. killers, warns, known facts, unknown fields, hidden fields, bridge warnings 인라인

> LLM에 pass 결과는 전달하지 않는다 — killers/warns만이 의미 있는 시그널.

### evaluateCar() 실행 흐름

> `src/core/evaluation/evaluateCar.ts`

```
1. 시스템 + 유저 프롬프트 빌드
2. client.complete() 호출
   - responseFormat: 'json_object'
   - temperature: 0.2
   - maxTokens: 1024 (기본)
3. MAX_TOKENS 에러 && maxTokens 미지정 시:
   → maxTokens: 2048로 1회 자동 재시도
4. JSON.parse → Zod 스키마 검증
5. CarEvaluation 반환 (schemaVersion: 1)
```

### runCarEvaluation() — API 키 게이트

```typescript
runCarEvaluation({ provider, apiKey, input, signal?, maxTokens? })
```

- `apiKey`가 null/empty/whitespace이면 `null` 반환 (LLM 호출 안 함)
- `createLLMClient()` 인스턴스 생성 → `evaluateCar()` 위임

---

## 보안: API 키 관리

API 키는 **React 상태(메모리)에만** 저장된다.

절대 기록하지 않는 곳:
- IndexedDB
- `chrome.storage`
- `localStorage`
- 그 어떤 영속 저장소

사이드패널 헤더에 "KEY NOT STORED" 표시. 패널을 닫거나 새로고침하면 재입력 필요.
