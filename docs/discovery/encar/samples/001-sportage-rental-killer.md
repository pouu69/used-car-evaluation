# Sample 001 — 스포티지 5세대 (렌터카 + 자차보험 공백)

**Status**: 🎯 Perfect showcase sample (both R05 and R08 killer rules trigger)
**Captured**: 2026-04-07
**Verdict**: `NEVER` (2 killer rules)

## URL

- Main listing: https://fem.encar.com/cars/detail/41623743
- History page: https://car.encar.com/history?carId=41623743

## Basic Info

| Field | Value |
|---|---|
| 차량번호 | 155우6124 |
| 제조사 | 기아 |
| 모델 | 스포티지 5세대 |
| 등급 | 디젤 2.0 4WD / 프레스티지 |
| 연식 | 2021/11 (22년형) |
| 주행거리 | 109,217km |
| 연료 | 디젤 |
| 색상 | 검정색 |
| 본체 | SUV |
| 신차가 (정가) | 3,044만원 |
| 신차 출고가 | 3,258만원 |
| 현재 판매가 | **2,100만원** (신차대비 ~69%) |
| 지역 | 부산 기장군 |
| 딜러 | 최상구 / 위카모빌리티(부산지점) |

## 🚨 Main page (`fem.encar.com`) 겉보기 상태

메인 페이지만 봤을 땐 깨끗한 매물:
- ✅ "프레임무사고 확인" 배지
- ✅ "엔카진단 통과" 배지
- ✅ "보험이력 0건"
- ✅ "성능점검등록"
- ✅ 압류/저당 0건

**→ 이 상태만 보고 산다면 사용자는 함정에 빠짐.**

## 💀 History page (`car.encar.com/history`)에서 드러나는 진실

- 🚨 **렌터카 이력**: "렌터카로 사용됐던 차량이지만, 보험 처리가 한 건도 없었어요!" 경고 배너
- 🚨 **신차 출고: 법인 명의** (서울 구로구)
- 🚨 **자차 보험 미가입 49개월** (2021/11 ~ 2025/12) — 사실상 4년 전체 기간 자차보험 없음
- **소유자변경 2건** (둘 다 매매업자 거래이전, 진짜 개인 소유자 0명)
- 정비/수리 이력 6건 (67,410km, 90,879km, 101,572km, 103,397km 시점)
  - 수리 부위: 프론트범퍼, 헤드램프, 리어도어, 전후펜더, 프론트도어 등 반복
- 정기검사 3건

## 룰 판정

| ID | 룰 | 상태 | 근거 |
|---|---|---|---|
| R01 | 보험이력 공개 | ✅ PASS | `detailFlags.isInsuranceExist=true` |
| R02 | 성능점검 공개 | ✅ PASS | `detailFlags.isHistoryView=true` |
| R03 | 엔카진단 | ✅ PASS | `detailFlags.isDiagnosisExist=true`, `advertisement.preVerified=true` |
| R04 | 프레임 무사고 | ✅ PASS | 메인페이지 "프레임무사고 확인" 배지 |
| **R05** | **렌트/택시 이력 없음** | ❌ **KILLER FAIL** | `uiData.item.drive.caution.rent=true` |
| R06 | 전손/침수/도난 없음 | ✅ PASS | `caution.theft=false` |
| R07 | 1인 신조 | ⚪ UNKNOWN | 렌터카라 평가 불가 |
| **R08** | **자차보험 공백 없음** | ❌ **KILLER FAIL** | `caution.no_insurance="있음"` (49개월) |
| R09 | 수리비 미확정 없음 | ✅ PASS | 모든 이력 확정됨 |
| R10 | 자잘한 사고 처리 | ⚪ N/A | 보험처리 0건 (자차보험 없음) |
| R11 | 가격 적정성 | ✅ PASS | 신차대비 ~69% (정상 범위) |

**판정**: `NEVER` (킬러 2개 — R05, R08)

## 기술적 발견

### 1. `fem.encar.com` 메인 페이지

- **골든 경로**: `window.__PRELOADED_STATE__.cars.base`
  - `base.category` — 제조사/모델/연식/신차가
  - `base.advertisement` — 가격/엔카진단/홈서비스/oneLineText
  - `base.spec` — 주행거리/연료/변속기
  - `base.condition.accident.recordView` — 사고이력 공개 여부
  - `base.condition.seizing` — 압류/저당
  - `base.contact` — 딜러 주소/전화
  - `base.partnership.dealer` — 딜러 이름/상사
  - `base.manage` — 등록일/조회수/관심수
  - `detailFlags` — `isInsuranceExist`, `isDiagnosisExist`, `isHistoryView`, `isDealer` 등

- **Lazy-loaded (비어있음, 추가 트리거 필요)**:
  - `cars.explain`, `cars.sellingpoint`
  - `cars.diagnosis.items`, `cars.inspect`, `cars.inspectSummary`
  - `cars.accident`, `cars.warranty`
  - `cars.profile`, `cars.falseCar`

- **DOM 폴백**: 해시 클래스(`EtIRdQ8gjq`, `is4Ms_K_3M` 등) 사용 → **클래스 셀렉터 절대 사용 불가**
  - 안정 앵커: `data-enlog-dt-eventname="..."`, `data-enlog-dt-eventnamegroup="..."`
  - dt/dd 라벨 매칭 ("연식", "주행거리", "연료", "차량번호")

### 2. `car.encar.com/history` 히스토리 페이지

- **Next.js 기반** (`__NEXT_DATA__` 존재)
- **골든 경로**: `window.__NEXT_DATA__.props.pageProps.uiData`
  - `uiData.intro` — 기본 정보
  - `uiData.summary` — 한 줄 경고 요약
  - `uiData.timeline[]` — 시간순 이력
  - `uiData.item.release` — 신차 출고 상세
  - `uiData.item.drive.contents[]` — 소유/운행 이력
  - `uiData.item.drive.caution.{rent, commercial, public, theft, owner}` — 킬러 룰 직결
  - `uiData.item.insurance[]` — 수리 이력 날짜별
  - `uiData.item.caution.{no_insurance, rent}` — 요약 경고
  - `uiData.enlogData.detail/text` — 엔카 자체 위험 태그

- **로그인 요구사항**: 상세 데이터는 로그인 사용자만 접근 가능 (이번 Playwright 세션 상태는 검증 필요)

### 3. 두 도메인 연결

메인 페이지의 `[data-enlog-dt-eventname="보험이력"]`과 `[data-enlog-dt-eventnamegroup="차량이력"]` 버튼은 **모두 같은 URL**로 새 탭 이동:
```
https://car.encar.com/history?carId={vehicleId}
```

## 익스텐션 설계 시사점

1. **`host_permissions`**: `fem.encar.com` + `car.encar.com` 모두 포함 필수
2. **Content script 주입**: 두 도메인 모두
3. **히스토리 페이지 데이터 획득 전략**:
   - (A) 사용자가 "보험/차량이력" 버튼 직접 클릭 시 그 탭에 주입된 content script가 데이터 전송
   - (B) 백그라운드에서 `fetch('/history?carId=X')` + 쿠키 사용 (로그인 상태 공유)
   - (C) 숨겨진 iframe 주입
   - **추천**: B (백그라운드 fetch) + 실패 시 A (사용자 직접 클릭 유도)로 폴백
4. **로그인 상태 감지**:
   - `chrome.cookies.get` 으로 엔카 세션 쿠키 확인
   - 또는 history 페이지 fetch 응답에서 로그인 리다이렉트 감지
5. **Lazy loaded 데이터**: 메인 페이지의 `cars.diagnosis`, `cars.inspect` 등은 추가 로드 필요. 버튼 클릭 트리거 또는 API 직접 호출 패턴 확인 필요 (다음 디스커버리에서)

## 스크린샷

- `001-sportage-overview.png` — 메인 페이지 전체
- `001-sportage-history.png` — 히스토리 페이지 전체
