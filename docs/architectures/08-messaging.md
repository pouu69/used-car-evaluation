# 메시징 프로토콜

> `src/core/messaging/protocol.ts`

모든 메시지는 `type` 문자열로 판별되는 유니온 타입이다.

---

## Message 유니온

```typescript
| { type: 'COLLECT_REQUEST';  carId; url; inPageData: InPageData }
| { type: 'COLLECT_FOR_TAB';  carId; url; tabId }
| { type: 'COLLECT_PROGRESS'; carId; stage: string }
| { type: 'COLLECT_RESULT';   carId; parsed; facts; report }
| { type: 'COLLECT_ERROR';    carId; reason: string }
| { type: 'ACK_RULE';         carId; ruleId }
| { type: 'REFRESH';          carId }
| { type: 'GET_LAST';         carId? }
```

---

## 메시지 흐름

### 자동 수집 (페이지 로드)

```
content/main-world.ts
  → window.postMessage (MainWorldPayload)
content/index.ts
  → chrome.runtime.sendMessage(COLLECT_REQUEST)
background/index.ts
  → broadcast(COLLECT_PROGRESS)
  → sendResponse(COLLECT_RESULT) + broadcast(COLLECT_RESULT)
sidepanel/useCarData
  → onMessage 리스너로 수신
```

### 사이드패널 직접 요청 (캐시 미스)

```
sidepanel/useCarData
  → chrome.runtime.sendMessage(COLLECT_FOR_TAB)
background/index.ts
  → chrome.scripting.executeScript (MAIN world 주입)
  → ... 수집 흐름 ...
  → broadcast(COLLECT_RESULT)
sidepanel/useCarData
  → onMessage 리스너로 수신
```

### 캐시 조회

```
sidepanel/useCarData
  → chrome.runtime.sendMessage(GET_LAST)
background/index.ts
  → IndexedDB 조회 → bridge+rules 재실행
  → sendResponse(COLLECT_RESULT)
```

### 새로고침

```
sidepanel/useCarData
  → chrome.runtime.sendMessage(REFRESH)
background/index.ts
  → IndexedDB cache 행 삭제
sidepanel/useCarData
  → chrome.runtime.sendMessage(COLLECT_FOR_TAB)
  → ... 수집 흐름 ...
```

### 규칙 무시 (ACK)

```
sidepanel/useCarData
  → chrome.runtime.sendMessage(ACK_RULE)
background/index.ts
  → IndexedDB acks 테이블에 저장 (7일 TTL)
```

---

## InPageData 구조

콘텐츠 스크립트 → 백그라운드로 전달되는 페이지 수집 결과:

```typescript
interface InPageData {
  preloadedState: unknown     // __PRELOADED_STATE__ 원본
  recordJson: unknown         // record API raw JSON
  diagnosisJson: unknown      // diagnosis API raw JSON
  inspectionJson: unknown     // inspection API raw JSON
  httpStatus: {               // 엔드포인트별 FetchStatus
    record: FetchStatus
    diagnosis: FetchStatus
    inspection: FetchStatus
  }
}
```

---

## MainWorldPayload

> `src/core/messaging/main-world.ts`

MAIN world → ISOLATED world 간 `window.postMessage` 전달 타입.

```typescript
interface MainWorldPayload {
  source: 'autoverdict/main-world'
  kind: 'state'
  payload: InPageData
}
```

`FetchStatus`를 `protocol.ts`에서 재수출한다.

---

## 타입 가드

각 메시지 타입별 타입 가드가 export된다:

- `isCollectRequest(msg)`
- `isCollectResult(msg)`
- `isCollectError(msg)`
- `isCollectProgress(msg)`
- `isRefresh(msg)`
- `isGetLast(msg)`
- `isAckRule(msg)`
- `isCollectForTab(msg)`
