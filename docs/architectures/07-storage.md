# 저장소

> `src/core/storage/db.ts`

`AutoVerdictDB`는 Dexie(IndexedDB 래퍼)를 확장한다.

- 데이터베이스 이름: `autoverdict`
- 스키마 버전: 1
- Chrome `storage` 권한 불필요 (IndexedDB는 웹 표준 API)

---

## 테이블 구조

| 테이블 | 키 | TTL | 내용 |
|--------|-----|-----|------|
| `cache` | `carId` | 24시간 | `{ carId, url, parsed, facts, report, cachedAt, expiresAt }` |
| `acks` | `[carId, ruleId]` (복합) | 7일 | `{ carId, ruleId, ackedAt, expiresAt }` |
| `saved` | `carId` | 무제한 | `{ carId, url, title, savedAt }` |
| `settings` | `key` | 무제한 | `{ key, value }` |

---

## 핵심 설계: 읽기 시 재계산

캐시에는 `parsed`(원본 데이터), `facts`, `report`를 모두 저장하지만,
**읽기 시(`GET_LAST`, 캐시 히트)마다 bridge와 rules를 `parsed`로부터 재실행**한다.

이유:
- 규칙 로직이 변경되면 확장 리로드 후 즉시 반영
- 캐시 무효화(invalidation) 없이 규칙 업데이트 적용
- `parsed`만이 "진실의 원천" — `facts`와 `report`는 파생 데이터

---

## sweepExpired()

```typescript
sweepExpired(): Promise<void>
```

`cache`와 `acks` 테이블에서 `expiresAt < Date.now()`인 행을 삭제한다.

호출 시점:
- `chrome.alarms`로 24시간마다 `sweep-expired` 알람 트리거
- 백그라운드 서비스워커에서 `chrome.alarms.onAlarm` 리스너로 실행

---

## 데이터 라이프사이클

```
매물 방문
  → 수집 + 파싱 + 평가
  → cache 테이블에 저장 (24시간 TTL)

재방문 (24시간 이내)
  → 캐시 히트 → parsed 에서 bridge+rules 재실행 → 즉시 반환

사용자 "IGNORE 7D" 버튼
  → acks 테이블에 (carId, ruleId) 저장 (7일 TTL)

24시간 경과
  → sweepExpired() 가 만료 행 삭제
  → 다음 방문 시 fresh 수집
```
