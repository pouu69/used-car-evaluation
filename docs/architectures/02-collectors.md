# 데이터 수집 계층

## CORS 문제와 해결

`api.encar.com`은 요청의 Origin을 기준으로 CORS를 검증한다.
서비스워커의 Origin은 `chrome-extension://...`이므로 거부된다.

**해결책:** `chrome.scripting.executeScript({ world: 'MAIN' })`으로 함수를 페이지의 JS 컨텍스트에 주입한다.
이 컨텍스트의 Origin은 `https://fem.encar.com`이므로 `api.encar.com`과 same-site이다.

> `credentials: 'include'`는 설정하지 않는다. default fetch가 이미 first-party 쿠키를 전송하며, `include`를 명시하면 CORS preflight이 트리거되어 거부된다.

---

## 2채널 아키텍처

### Channel A — 콘텐츠 스크립트 자동 수집 (주)

페이지 로드 시 자동 실행되는 기본 경로.

```
[MAIN world] main-world.ts
  → __PRELOADED_STATE__ 에서 vehicleId, vehicleNo 추출
  → api.encar.com 3개 엔드포인트 병렬 fetch (7초 abort 타임아웃)
  → window.postMessage({ source: 'autoverdict/main-world', kind: 'state', payload })

[ISOLATED world] index.ts
  → window.addEventListener('message') 로 MAIN world 결과 수신
  → chrome.runtime.sendMessage(COLLECT_REQUEST) 로 백그라운드 전송
  → history.pushState/replaceState 패치로 SPA 네비게이션 감지 → 재수집
```

### Channel B — 사이드패널 직접 트리거 (보조)

사이드패널이 열렸을 때 캐시가 비어 있으면 사용되는 폴백 경로.

```
[Side Panel] useCarData hook
  → chrome.runtime.sendMessage(COLLECT_FOR_TAB)

[Background] index.ts
  → chrome.scripting.executeScript 로 mainWorldCollect 함수 주입
  → 주입 함수는 문자열화(stringify)되므로 모듈 스코프 참조 불가
  → 이후 흐름은 Channel A와 동일
```

---

## FetchStatus 전파

각 API fetch는 `FetchStatus`를 반환하며, 전체 파이프라인을 관통한다.

| 상태 | 의미 |
|------|------|
| `'ok'` | 2xx, JSON 파싱 성공 |
| `'not_found'` | 404 (개인 매물의 diagnosis/inspection에서 정상) |
| `'unauthorized'` | 401/403 |
| `'error'` | 5xx, 네트워크 실패, 타임아웃 |
| `'skipped'` | 미시도 (vehicleId 없음 등) |

흐름: `collector` → `inPageData.httpStatus` → `background` → `orchestrate()` → `resolveApi()` → `FieldStatus.reason`

---

## 소스 레지스트리

> `src/core/collectors/sources.ts`

`SourceId`(안정 문자열 enum)와 `SOURCE_REGISTRY`로 우선순위를 정의한다.

| 소스 | 우선순위 | 수집 모드 |
|------|----------|-----------|
| `manual` | 1000 | page_state |
| `preloaded_state` | 100 | page_state |
| `record_api` | 95 | main_world_fetch |
| `diagnosis_api` | 95 | main_world_fetch |
| `inspection_api` | 95 | main_world_fetch |
| `history_ui_data` | 80 | background_fetch |
| `next_data` | 70 | page_state |
| `fetch_interceptor` | 60 | injected_script |
| `main_dom` | 30 | page_dom |

---

## 다중 소스 병합

> `src/core/collectors/merge.ts`

`mergeFieldStatus(candidates[])` — 여러 `{ source, status }` 후보를 단일 `FieldStatus<T>`로 해소한다.

### 병합 규칙

1. `kind: 'value'`인 후보가 있으면 → 최고 우선순위 소스가 승리
2. 두 `value` 후보의 값이 다르면 → `merge_conflict:A≠B` 경고 발생, 고우선순위 채택
3. 모두 `loading` → `loading`
4. 모두 `hidden_by_dealer` → `hidden_by_dealer`
5. 그 외 → `parse_failed` + 모든 소스의 reason 결합

---

## 콘텐츠 스크립트 상세

### main-world.ts (MAIN world)

> `src/content/fem-encar/main-world.ts`

- 페이지 로드 즉시 `doCollect()` 실행
- `window.__PRELOADED_STATE__`에서 `vehicleId`, `vehicleNo` 추출
- 3개 API 병렬 호출:
  - `record`: `/v1/readside/record/vehicle/{vehicleId}/open?vehicleNo={vehicleNo}`
  - `diagnosis`: `/v1/readside/diagnosis/vehicle/{vehicleId}`
  - `inspection`: `/v1/readside/inspection/vehicle/{vehicleId}`
- 각 요청에 7초 `AbortController` 타임아웃 설정
- `inflight` Promise로 동시 리스너에 동일 결과 보장

### index.ts (ISOLATED world)

> `src/content/fem-encar/index.ts`

- `window.addEventListener('message')`로 MAIN world 결과 수신
- `chrome.runtime.sendMessage(COLLECT_REQUEST)` 전송
- `history.pushState/replaceState` 패치로 SPA 네비게이션 감지 → 재수집 트리거
