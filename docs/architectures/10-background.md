# 백그라운드 서비스워커

> `src/background/index.ts`

Manifest V3 서비스워커. 모든 Chrome 메시지를 처리하고, 수집 → 파싱 → 평가 파이프라인을 오케스트레이션한다.

---

## 메시지 핸들러

### COLLECT_REQUEST (콘텐츠 스크립트 → 백그라운드)

콘텐츠 스크립트가 페이지 데이터를 수집한 후 전송.

```
1. IndexedDB 캐시 확인
   → 히트 & 미만료: parsed에서 bridge+rules 재실행 → COLLECT_RESULT 반환
2. 캐시 미스:
   → broadcast(COLLECT_PROGRESS { stage: 'fetching_reports' })
   → inPageData 사용 (또는 없으면 runMainWorldCollect(tabId))
   → orchestrate() → encarToFacts() → evaluate()
   → IndexedDB 캐시 저장 (24시간 TTL)
   → sendResponse(COLLECT_RESULT) + broadcast(COLLECT_RESULT)
3. 18초 워치독이 전체 흐름과 경쟁
   → 타임아웃 시 COLLECT_ERROR { reason: 'watchdog_timeout' } 반환
```

### COLLECT_FOR_TAB (사이드패널 → 백그라운드)

사이드패널이 열렸을 때 캐시가 비어 있으면 전송.

- `tabId`를 사용해 `runMainWorldCollect(tabId)` 실행
- `chrome.scripting.executeScript`로 `mainWorldCollect` 함수를 탭의 MAIN world에 주입
- 이후 흐름은 COLLECT_REQUEST와 동일

### GET_LAST (사이드패널 → 백그라운드)

사이드패널 열릴 때 캐시 조회.

- `carId` 지정 시 해당 행 조회
- 미지정 시 가장 최근 행 반환
- **항상 `parsed`에서 `facts` + `report` 재계산** → 현재 규칙 버전 반영

### REFRESH (사이드패널/콘텐츠 → 백그라운드)

- `carId`에 해당하는 IndexedDB cache 행 삭제
- 이후 사이드패널이 COLLECT_FOR_TAB으로 재수집 트리거

### ACK_RULE (사이드패널 → 백그라운드)

- `acks` 테이블에 `{ carId, ruleId, ackedAt, expiresAt }` 저장
- TTL: 7일

---

## mainWorldCollect 함수

> `src/background/main-world-collector.ts`

`chrome.scripting.executeScript({ world: 'MAIN' })`로 탭에 주입되는 함수.

**핵심 제약:** 주입 시 문자열화(stringify)되므로 **모듈 스코프 심볼을 참조할 수 없다**. 함수 내부에 필요한 모든 로직이 자체 포함되어야 한다.

동작:
1. `window.__PRELOADED_STATE__`에서 `vehicleId`, `vehicleNo` 추출
2. 3개 API 병렬 fetch (7초 타임아웃)
3. 결과를 직접 반환 (Channel B에서는 `postMessage` 대신 `executeScript` 반환값 사용)

---

## 알람

```typescript
chrome.alarms.create('sweep-expired', { periodInMinutes: 60 * 24 })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sweep-expired') {
    sweepExpired()  // 만료된 cache/acks 행 삭제
  }
})
```

---

## 액션 클릭

```typescript
chrome.action.onClicked → chrome.sidePanel.open({ tabId: tab.id })
```

확장 아이콘 클릭 시 사이드패널을 연다.

---

## 오케스트레이션 흐름도

```
메시지 수신
  ├─ COLLECT_REQUEST / COLLECT_FOR_TAB
  │    ├─ 캐시 히트 → bridge+rules 재실행 → 즉시 응답
  │    └─ 캐시 미스
  │         ├─ inPageData 있음 → orchestrate() 직접 호출
  │         └─ inPageData 없음 → runMainWorldCollect(tabId) → orchestrate()
  │              ↓
  │         encarToFacts() → evaluate()
  │              ↓
  │         IndexedDB 저장 → COLLECT_RESULT 전송
  │
  ├─ GET_LAST → IndexedDB 조회 → bridge+rules 재실행 → 응답
  ├─ REFRESH → IndexedDB 삭제
  └─ ACK_RULE → acks 테이블 저장
```
