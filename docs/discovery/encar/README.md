# Encar Discovery — 통합 정리

**Version**: v2 (2026-04-09)
**Status**: Phase 0 → Post-pivot → 개인매물 분기까지 반영
**Scope**: `fem.encar.com` (메인 상세) + `api.encar.com` (구조화 API)
**Samples**: 7건 (001 스포티지 · 002/003 팰리세이드 · 004 BMW E90 · 005 BMW G30 딜러 · **006 BMW G30 개인(CLIENT)** · **007 BMW F30 렌트양성**)
**Core Principle**: **AI-free 결정론적 파서** — LLM/비전 없이 JSON + 최소 DOM만 사용

> ⚠️ **Post-pivot notice (2026-04-08 / 04-09)**: 이 문서의 §2~§6 본문은 **Phase 0 discovery 시점**의 듀얼 레이어(state-first + DOM-second) 전략을 기록한다. 이후 실제 구현은 다음 두 단계를 거쳐 바뀌었다:
>
> 1. **API 피벗 (2026-04-08)**: `api.encar.com/v1/readside/{record,diagnosis,inspection}/vehicle/{id}` 공식 JSON 엔드포인트를 발견 → HTML 리포트 스크래핑(S4/S5/S6) 을 전부 제거하고 구조화 JSON 으로 대체. 세부는 `docs/design/DESIGN.md` §3/§4 참조.
> 2. **개인매물 분기 (2026-04-09)**: Sample 006 수집에서 개인(CLIENT) 매물은 `/diagnosis/` 와 `/inspection/` 이 **HTTP 404** 를 반환하고 `record` 만 동작함을 발견 → bridge 레이어에 `isPersonalListing()` + **F5 불변식** 추가. R03/R04 는 개인매물에 대해 `unknown` severity 로 라우팅, R05~R10 은 딜러·개인 양쪽 모두 `record` API 로 동작. 자세한 사항은 `samples/006-*.md` 참조.
>
> **현재 상태의 진실의 원천은 `docs/design/DESIGN.md` v2.1**. 이 디스커버리 문서는 역사 기록 + 샘플 카탈로그로 계속 유지된다.

---

## 0. 샘플 카탈로그 (최신 순)

| # | 차량 | 판매자 | 핵심 발견 | 파일 |
|---|---|---|---|---|
| 007 | BMW 3시리즈 F30 320i | 딜러 | **첫 "rent=true" 양성 샘플**. `driveCaution.rent=true` + `caution.rent='있음'` + `enlogData.text='use_rent'` + `release.use='(비,대여)사업용'` 4필드 동시 활성. 첫 `recordApi.loan=1` 저당 관찰. `master.accdient=false` + `outers.length=3` → R04 PASS (교환 3건이 프레임 아님). R05+R07(5회 이전)+R08(공백 2회)+R10 복합 NEVER | [007](samples/007-bmw-f30-320i-rent-history.md) |
| 006 | BMW 5시리즈 G30 530i | **개인(CLIENT)** | 첫 비딜러 샘플. inspection/diagnosis API 는 404. `contact.userType='CLIENT'`, `detailFlags.isDealer=false`, `spec.tradeType=null`, `importType='NONE_IMPORT_TYPE'`. **F5 불변식 유발** | [006](samples/006-bmw-g30-530i-individual-seller.md) |
| 005 | BMW 5시리즈 G30 530i | 딜러 | 엔카진단 없는 외제 딜러. `/inspection/` 응답 구조 완전 관찰 — `master.detail.{waterlog, recall, tuning}`, `outers[].statusTypes` (교환/판금/부식). 히스토리 `release` 스키마 확장: `nation`, `use`, `fuel`, `cityConsumption` | [005](samples/005-bmw-g30-530i-no-diagnosis-insurance-gap.md) |
| 004 | BMW 3시리즈 E90 328i | 딜러 | 첫 외제차 샘플. **법인 ≠ 렌트** 반증 (F1 불변식 본거지). 19년차 고주행 | [004](samples/004-bmw-e90-old-high-mileage.md) |
| 003 | 현대 팰리세이드 2.2 | 딜러 | R10 타차가해 257만원 외제 임계값 검증. `tradeType='D'` | [003](samples/003-palisade-22-rental.md) |
| 002 | 현대 팰리세이드 | 딜러 | `isDiagnosisExist=false`, 비정상 날짜(`3000년`) | [002](samples/002-palisade-no-diagnosis-rental.md) |
| 001 | 기아 스포티지 5세대 | 딜러 | 최초 샘플. R05 + R08 두 killer 완비. `__PRELOADED_STATE__`/`__NEXT_DATA__` 발견 | [001](samples/001-sportage-rental-killer.md) |

### 0.1 6 샘플을 통해 확정된 enum 카탈로그

```typescript
type EncarUserType    = 'CLIENT' | 'DEALER';            // 'PERSONAL' 은 관측되지 않음
type EncarImportType  = 'REGULAR_IMPORT' | 'BRAND_IMPORT' | 'NONE_IMPORT_TYPE';
type EncarAdType      = 'AD_NORMAL' | 'NORMAL';         // 005 vs 006 차이
type EncarTradeType   = 'D' | 'I' | null;               // 개인매물은 null (not 'I')
type EncarImportNation = '오스트리아' | '독일' | '일본' | /* ... 지속 확장 */ string;
```

### 0.2 딜러 vs 개인매물 엔드포인트 가용성 (Sample 006 실측)

| 엔드포인트 | 딜러 | 개인(CLIENT) |
|---|---|---|
| `__PRELOADED_STATE__.cars.base` | ✅ | ✅ (`vin=null`, `tradeType=null`) |
| `/readside/record/vehicle/{id}/open` | ✅ | **✅** (041707401 실측: 사고 4건 + 보험공백 2건 반환) |
| `/readside/diagnosis/vehicle/{id}` | ✅ | ❌ **HTTP 404** |
| `/readside/inspection/vehicle/{id}` | ✅ | ❌ **HTTP 404** |
| `car.encar.com/history?carId={id}` (uiData) | ✅ | ✅ |

→ 파서는 404 를 네트워크 오류와 구분해 `FetchStatus='not_found'` 로 마킹하고, orchestrate 단에서 `parse_failed('no_report_for_personal')` 로 변환. bridge 의 `isPersonalListing()` 가 R03 을 KILLER 대신 `unknown` 으로 라우팅.

---

## 1. 목적

엔카의 중고차 상세 페이지에서 **11개 닥신 체크리스트 룰**을 결정론적으로 판정하기 위한 데이터 획득 파이프라인의 입력 자료이다. 이 문서는:

- 어떤 URL에서 어떤 데이터를 얻는지
- 각 데이터가 로그인·렌더링·lazy loading에 어떻게 영향받는지
- 파서가 의존해도 되는 **안정 앵커**와 의존하면 안 되는 것
- 룰별 데이터 가용성을 정리한 **Coverage Matrix v1**

## 2. 5개 데이터 소스 맵

| # | URL 패턴 | 획득 수단 | 로그인 | 주 데이터 |
|---|---|---|---|---|
| S1 | `fem.encar.com/cars/detail/{carId}` | `window.__PRELOADED_STATE__.cars` | 불필요 | 기본정보, 가격, 딜러, detailFlags |
| S2 | 〃 (같은 페이지 DOM) | `document.querySelector` + `innerText` | 불필요 | 진단 배지, 프레임/패널 상세, 내차/타차 피해 합계 |
| S3 | `car.encar.com/history?carId={carId}` | `window.__NEXT_DATA__.props.pageProps.uiData` | **필요** | 렌트/택시 플래그, 보험공백, 타임라인, 보험상세 |
| S4 | `fem.encar.com/cars/report/diagnosis/{carId}` | SSR HTML + `innerText` 탭 파싱 | 부분 | 진단 판정, 부위별 상태, 코멘트 |
| S5 | `fem.encar.com/cars/report/inspect/{carId}` | SSR HTML + 라벨 매칭 | 부분 | 성능점검 공식표 (용도변경, 사고이력, 특별이력) |
| S6 | `fem.encar.com/cars/report/accident/{carId}` | SSR HTML (아코디언 `모두 펼쳐보기` 클릭) | **필요** | 보험처리 금액 내역 |

> S1/S2는 한 페이지에서 함께 획득. S3~S6는 별도 URL을 백그라운드 fetch.

## 3. 파서 전략 — 듀얼 레이어 (state-first + DOM-second)

### 3.1 상태 우선 (JSON-first)

1. `window.__PRELOADED_STATE__.cars.base` 가 있으면 **여기서 모든 기본값 추출** (S1)
2. `window.__NEXT_DATA__.props.pageProps.uiData` 가 있으면 여기서 렌트/보험공백 추출 (S3)

이 두 경로는 **Encar 내부 리덕스/Next.js hydration 구조**라서 class 해시 변경의 영향을 받지 않는다.

### 3.2 DOM 폴백 (detail page)

- `__PRELOADED_STATE__.cars.diagnosis`, `cars.inspect`, `cars.accident` 등은 **lazy-load** 되어 초기엔 비어 있다.
- 따라서 진단/패널/내차피해 집계 같은 **상세는 DOM에서 직접 추출**한다.
- DOM 접근 원칙:
  - ❌ **class 셀렉터 금지** (`.EtIRdQ8gjq` 등 전부 해시)
  - ✅ `data-enlog-dt-eventname`, `data-enlog-dt-eventnamegroup` 값으로 앵커
  - ✅ `dt` 텍스트 ↔ 인접 `dd` 매칭 ("연식", "주행거리", "차량번호")
  - ✅ `innerText`를 `\n` 으로 split 후 **라벨/값 화이트리스트 매칭**
  - ✅ 정규식은 **정확히 매칭되는 것만** (탐욕적 `.*` 금지)

### 3.3 Report 페이지 파서 (SSR)

엔카 리포트 3종은 **순수 SSR HTML** 이고, "모두 펼쳐보기" 버튼이 열려 있어야 accordion 내용이 DOM에 존재한다. 백그라운드 fetch 시에는 HTML만 받아오면 SSR 시점에 이미 펼쳐진 상태이므로 별도 click이 불필요한 경우가 많지만, 사용자 브라우저에서 iframe/탭으로 로드할 경우 `"모두 펼쳐보기"` 버튼을 자동 클릭해야 한다.

```typescript
async function expandAllAccordions(doc: Document) {
  const expandBtn = Array.from(doc.querySelectorAll('button'))
    .find(b => b.textContent?.trim() === '모두 펼쳐보기');
  if (expandBtn) (expandBtn as HTMLElement).click();
  const laterBtn = Array.from(doc.querySelectorAll('button'))
    .find(b => b.textContent?.trim() === '다음에');
  if (laterBtn) (laterBtn as HTMLElement).click();
}
```

로그인 요구 감지:
```typescript
function detectLoginRequired(doc: Document): boolean {
  return !!Array.from(doc.querySelectorAll('*'))
    .find(el => /로그인\s*후.*확인/.test(el.textContent || ''));
}
```

## 4. 관측된 스키마

### 4.1 `__PRELOADED_STATE__.cars.base` (S1)

```typescript
interface EncarCarBase {
  category: {
    manufacturerName: string;   // '기아'
    modelGroupName: string;     // '스포티지'
    modelName: string;          // '스포티지 5세대'
    gradeName: string;          // '디젤 2.0 4WD'
    gradeDetailName?: string;   // '프레스티지'
    yearMonth: string;          // '202111'
    formYear: string;           // '2022'
    newPrice?: number;          // 3044 (만원)
    domestic: boolean;          // true=국산, false=외제
    importType?: 'REGULAR_IMPORT' | 'BRAND_IMPORT' | string;
  };
  advertisement: {
    price: number;              // 2100
    preVerified: boolean;       // 엔카진단
    trust: string[];            // ['Warranty', ...]
    oneLineText?: string;
    homeService?: boolean;
  };
  spec: {
    mileage: number;            // 109217
    fuelName: string;
    transmissionName: string;
    colorName: string;
    bodyName: string;
    tradeType?: 'D' | 'I';      // Dealer / Individual
  };
  condition: {
    accident?: { recordView: boolean };
    seizing?: { mortgage: number; seizing: number };
  };
  contact: { address: string; phone: string };
  partnership?: { dealer: { name: string; shop: string } };
  manage?: { regDate: string; viewCnt: number; wishCnt: number };
  vin?: string;
  vehicleNo: string;
}

interface DetailFlags {
  isInsuranceExist: boolean;    // R01
  isHistoryView: boolean;       // R02
  isDiagnosisExist: boolean;    // R03
  isDealer: boolean;
}
```

Lazy-load (초기엔 빈 값): `cars.explain`, `cars.sellingpoint`, `cars.diagnosis.items`, `cars.inspect`, `cars.inspectSummary`, `cars.accident`, `cars.warranty`, `cars.profile`, `cars.falseCar`

### 4.2 `__NEXT_DATA__.props.pageProps.uiData` (S3)

```typescript
interface UiData {
  intro: { /* 기본 정보 */ };
  summary: string;              // "렌터카로 사용됐던..." 또는 "용도 변경 이력이 없는..."
  timeline: TimelineEvent[];
  item: {
    release: {
      date: string;
      owner: string;            // '법인' | '개인' | '리스' ...
      flag?: 'CORPORATION' | 'DEALER' | string;
      storePrice?: string;      // '3,044만원' | '정보없음'
    };
    drive: {
      contents: Array<{ /* 소유/운행 이력 1건 */ }>;
      caution: {
        rent: boolean;          // R05 ← 직접 사용 (법인 != 렌트)
        commercial: boolean;
        public: boolean;
        theft: boolean;         // R06
        owner: boolean;
      };
    };
    insurance: Array<{
      contents: Array<
        | { type: 'insurance'; name: string; insurance: InsuranceDetail }
        | { type: 'repair';    name: string; repair: string[] }
      >;
    }>;
    caution: {
      no_insurance?: '있음' | '없음';   // R08 ← 문자열 주의
      rent?: '있음' | '없음';
      recall?: string;                  // '2건'
    };
  };
  enlogData: {
    detail: string;             // CSV: "new_release_corporate,noinsured,..."
    text: string;               // 'no_insurance_rent' | 'use_rent' | 'no_change' ...
  };
  layerData?: { flag: string };
}

interface TimelineEvent {
  date: string;                 // '00년 01월' (비정상값 가능)
  title?: string;
  contents: Array<{
    title: string;
    layerData?: { flag?: string; content?: Array<{ name: string; value: string }> };
  }>;
}

interface InsuranceDetail {
  date: string;
  partPrice: string;            // '3만원'
  laborPrice: string;
  paintingPrice: string;
  detailList: Array<{
    name: '교환' | '탈착' | '도장' | '수리';
    value: string[];            // 부위 리스트
  }>;
}
```

### 4.3 진단 리포트 DOM 패턴 (S2 + S4)

`innerText` 를 `\n`/탭으로 split 한 뒤 정규식:

```typescript
const DIAG_RX = {
  frameNoAccident: /^프레임무사고 확인$/,
  frameDiag: /^프레임 진단(정상|수리|교환)$/,
  panelDiag: /^외부패널 진단(정상|교환|판금)$/,
  exchange: /^교환\s*(\d+)$/,
  paneling: /^판금\s*(없음|\d+)$/,
  rust: /^부식\s*(없음|있음)$/,
  ownDamageTotal: /^내차\s*피해총\s*([\d,]+)원\s*\((\d+)회\)$/,
  otherDamageTotal: /^타차\s*가해총\s*([\d,]+)원\s*\((\d+)회\)$/,
  specialNote: /^특이\s*사항\s*(없음|있음)$/,
  judgment: /^(무사고|사고)\s*차량으로\s*판정/,
};
```

### 4.4 성능점검 리포트 라벨 매칭 (S5)

```typescript
const INSPECT_LABELS = new Set([
  '변속기 종류', '사용연료', '보증유형', '원동기 형식',
  '주행거리 계기상태', '주행거리 상태', '차대번호표기',
  '튜닝', '특별이력', '용도변경', '배출가스', '리콜대상',
  '사고이력', '단순수리', '제시번호',
]);
```

## 5. Coverage Matrix v1 — 룰 × 데이터 소스

| 룰 | 필드 | 소스 | 로그인 | 파서 신뢰도 |
|---|---|---|---|---|
| R01 보험이력 공개 | `detailFlags.isInsuranceExist` | S1 | X | 🟢 High |
| R02 성능점검 공개 | `detailFlags.isHistoryView` | S1 | X | 🟢 High |
| R03 엔카진단 | `detailFlags.isDiagnosisExist` / `advertisement.preVerified` | S1 | X | 🟢 High |
| R04 프레임 무사고 | DOM `프레임무사고 확인` 뱃지 + `frameDiag` | S2 / S5 | X | 🟢 High (진단차량에 한해) |
| **R05 렌트/택시** | `uiData.item.drive.caution.rent` | **S3** | **✅** | 🟢 High |
| R06 전손/침수/도난 | `uiData.item.drive.caution.theft` + enlogData CSV | S3 | ✅ | 🟡 Med (enlogData 보조) |
| R07 1인 신조 | `uiData.item.drive.contents[].owner` 집계 | S3 | ✅ | 🟡 Med (복잡) |
| **R08 자차보험 공백** | `uiData.item.caution.no_insurance` | **S3** | **✅** | 🟢 High |
| R09 수리비 미확정 | S6 accident 페이지 "미확정" 문구 | S6 | ✅ | 🟡 Med |
| R10 자잘한 사고 | `insurance[].contents[].insurance.*Price` 합산 | S3/S6 | ✅ | 🟢 High |
| R11 가격 적정성 | `advertisement.price` / `category.newPrice` | S1 | X | 🟡 Med (시세 외부 필요) |
| (R12 리콜) | `item.caution.recall` + enlogData `recall` | S3 | ✅ | 🟢 High (부가) |
| (R13 노후/고주행) | `category.yearMonth` + `spec.mileage` | S1 | X | 🟢 High (부가) |

**해석 (Phase 0 기준, 아래 post-pivot 업데이트 참조)**:
- 로그인 없이 얻을 수 있는 건 **R01~R04, R11, R13** — 약 6개.
- **R05, R08 (킬러)**을 비롯한 나머지는 **전부 로그인 필수**. → 익스텐션은 로그인 유도 UX 필수.
- 로그인 미상태에서 킬러 룰은 `FieldStatus.parse_failed{reason: 'login_required'}`로 표시하고 사용자에게 로그인 CTA 노출.

> 🔄 **Post-pivot 수정 (2026-04-08)**: 위 해석은 틀렸다. `api.encar.com/v1/readside/record/vehicle/{id}/open` 엔드포인트의 `open` 쿼리 필드 덕분에 **R05~R10 전부 로그인 없이 동작**. 현재 실상:
> - 딜러 매물: 11 룰 모두 로그인 없이 판정 가능
> - 개인(CLIENT) 매물: R01/R02/R05~R10 은 로그인 없이 판정, R03/R04 는 API 원천 부재로 `unknown` 고정 (F5)
> - 즉 실제로 로그인이 필요한 룰은 **없다**. 로그인 유도 UX 는 제거됨.

## 6. 엣지 케이스 카탈로그

### 6.1 데이터 결손
- **500 에러 or `uiData` 미존재**: 상세이력을 안 보여주는 매물 존재. → `unavailable` 상태로 Graceful degrade.
- **`storePrice: "정보없음"`**: 노후 매물은 누락 가능. optional.
- **날짜 필드 `3000년 01월 16일` / `00년 01월`**: Zod 스키마는 `z.string()` 로 받고 후처리에서 `parse → fallback`.
- **Lazy-load 비어있음**: `cars.diagnosis.items` 등 초기 빈 배열 → DOM 폴백.

### 6.2 잘못된 추론 피하기
- **법인 != 렌터카**: Sample 004 BMW는 `release.flag='CORPORATION'` 이지만 `driveCaution.rent=false`. **반드시 `rent` 플래그 직접 사용** (post-pivot: `recordApi.loan/business/government` 정수 사용, F1 불변식).
- **`type='repair'` ≠ 사고**: `insurance[].contents[].type` 는 `'insurance' | 'repair'`. 사고 카운트는 `insurance`만.
- **"보험 0건" ≠ 무사고**: Sample 001은 보험 0건이지만 자차보험 자체가 없어서 집계 불가. → `no_insurance` 먼저 체크.
- **개인매물 ≠ tradeType='I'**: Sample 006 관측 — 개인(CLIENT) 매물의 `spec.tradeType` 은 `null`. 딜러는 `'D'`, `'I'` 는 위탁판매(consignment) 라 실제로는 잘 안 보임. 개인 판별은 `contact.userType === 'CLIENT'` 또는 `detailFlags.isDealer === false` 로 해야 한다 (F5).
- **`isDiagnosisExist=false` ≠ KILLER**: 딜러 매물이면 KILLER 맞지만, 개인매물이면 엔카진단 자체를 받을 수 없는 구조 → `unknown` 으로 라우팅해야 한다.

### 6.3 로그인 상태 감지
- `로그인 후 확인` 텍스트가 페이지에 존재 → `login_required`
- 쿠키 기반: `chrome.cookies.get({ url: 'https://car.encar.com', name: <session-key> })`
- State machine: `logged_in | logged_out | session_expired | unknown`

### 6.4 DOM 안정성
- **클래스는 전부 해시** (`EtIRdQ8gjq`, `is4Ms_K_3M`) — 빌드마다 변경.
- **안정 앵커 허용 리스트**:
  - `[data-enlog-dt-eventname="..."]`
  - `[data-enlog-dt-eventnamegroup="..."]`
  - `dt` 텍스트 라벨 (`연식`, `주행거리`, `차량번호`, `연료`, `변속기`)
  - `aria-label`, `aria-labelledby`

## 7. 샘플 카탈로그

> ℹ️ 이 표는 §0 의 최신순 카탈로그를 발견 순으로 다시 본다. 007 이후는 §0 만 업데이트한다.

| # | 차량 | 판매자 | 주요 학습 |
|---|---|---|---|
| [001](samples/001-sportage-rental-killer.md) | 기아 스포티지 5세대 (2021) | 딜러 | `__PRELOADED_STATE__`, `uiData`, 두 도메인 연결, R05+R08 트리거 |
| [002](samples/002-palisade-no-diagnosis-rental.md) | 현대 팰리세이드 (2023) | 딜러 | `isDiagnosisExist=false`, `insurance.type`, 리콜 타임라인, 비정상 날짜 |
| [003](samples/003-palisade-22-rental.md) | 현대 팰리세이드 2.2 (2022) | 딜러 | 타차가해 257만원 R10 WARN, `tradeType='D'`, `변경등록` 이벤트 |
| [004](samples/004-bmw-e90-old-high-mileage.md) | BMW 3시리즈 E90 (2007) | 딜러 | 외제차 (`domestic=false`), DOM 진단 상세 파싱, **법인 ≠ 렌트** (F1), 노후/고주행 |
| [005](samples/005-bmw-g30-530i-no-diagnosis-insurance-gap.md) | BMW 5시리즈 G30 530i (2019) | 딜러 | 엔카진단 없는 외제 딜러, `/inspection/` 응답 구조 완전 관찰 (`master.detail.waterlog`, `outers[].statusTypes`), `release` 스키마 확장 (`nation`, `use`, `fuel`, `cityConsumption`) |
| [006](samples/006-bmw-g30-530i-individual-seller.md) | BMW 5시리즈 G30 530i (2017) | **개인(CLIENT)** | **첫 비딜러 샘플** — inspection/diagnosis API 는 404, record API 는 동작. `contact.userType='CLIENT'`, `isDealer=false`, `tradeType=null`, `vin=null`, `importType='NONE_IMPORT_TYPE'`. **F5 불변식 유발** |
| [007](samples/007-bmw-f30-320i-rent-history.md) | BMW 3시리즈 F30 320i (2018) | 딜러 | **첫 `rent=true` 양성 샘플** — `driveCaution.rent`, `caution.rent`, `enlogData.text='use_rent'`, `release.use='(비,대여)사업용'` 4필드 교차검증. 첫 `recordApi.loan=1` 저당. `outers.length=3` (교환) 이지만 `master.accdient=false` → R04 PASS (교환 ≠ 프레임사고) 엣지케이스. |

## 8. 파서 아키텍처 함의 (Phase 0 기준, 실제 구현은 `DESIGN.md` §4 참조)

> 🔄 아래 §8 은 Phase 0 설계 입력이고, 실제 수집 파이프라인은 `docs/design/DESIGN.md` §4 로 대체됐다. 핵심 변경:
>
> - **MAIN world 주입** (`chrome.scripting.executeScript`) 으로 `fem.encar.com` 컨텍스트에서 직접 `api.encar.com` 호출 → CORS 우회
> - **`credentials: 'include'` 금지** — api.encar.com 의 CORS preflight 가 거부함. default `fetch(url)` 이 same-site 쿠키를 자동 포함
> - `FetchStatus` (`ok | not_found | unauthorized | error | skipped`) 를 각 엔드포인트별로 기록 → 404(개인매물) ≠ 네트워크 에러 구분
> - HTML 리포트 파싱(S4/S5/S6) 은 **전부 삭제**. `api.encar.com/v1/readside/{record,diagnosis,inspection}/vehicle/{id}` JSON 으로 대체

**Phase 0 원본 설계** (역사 참고):

1. **Content Script 주입 도메인**: `fem.encar.com/*`, `car.encar.com/*` 모두 `manifest.host_permissions` 에 포함.
2. **State machine**:
   - `detect → collectS1 → collectS2(DOM) → fetchS3 → [optional] fetchS4/S5/S6 → bridge → rules`
3. **각 stage의 실패 처리**: `FieldStatus<T>` discriminated union으로 loading/value/parse_failed/hidden_by_dealer/timeout 5상태 모두 전파.
4. **Fetch 전략**:
   - S3/S4/S5/S6은 background service worker에서 `fetch(url, { credentials: 'include' })` — 사용자 쿠키 자동 사용.
   - 실패 시 사용자 탭 직접 방문 유도.
5. **캐시**: 동일 `carId` 는 24시간 IndexedDB 캐시. 수동 refresh 버튼으로 무효화.
6. **로그인 미탐지 시**: S1/S2만 가지고 **부분 판정**. 킬러 룰은 `NEEDS_LOGIN` 상태로 표시 + "로그인 후 재평가" CTA.

## 9. 미발견 & 후속 디스커버리 필요

- 🔲 **1인신조 + 엔카진단 + 무사고 + 보험공백 없는 이상적 PASS 케이스** — 긍정 샘플 여전히 없음.
- 🔲 **프레임 사고 실매물** — `diagnosisApi.items[].resultCode === 'EXCHANGE'` 혹은 `outers[].statusTypes` 에서 `'교환(교체)'` 가 프레임 부위에 달린 케이스.
- 🔲 **딜러가 보험이력 비공개** 매물 — `isInsuranceExist=false` UI/스키마 관측.
- 🔲 **전손/침수 매물** — `recordApi.totalLossCnt>0` 또는 `inspectionApi.master.detail.waterlog===true`.
- 🔲 **개인매물의 `recordApi` 에서 `openData=false` 케이스** — 개인매물이라도 레코드 비공개일 가능성. 현재 006 은 `openData=true`.
- ✅ **로그인 상태에서의 S3~S6 실제 응답 차이** — 해소됨: API 로 전부 대체되어 로그인이 원천 불필요.
- 🔲 **시세 비교용 외부 API** (R11) — 가이드에 따라 다른 같은 연식 매물 평균 필요.
- 🔲 **모바일 뷰 `m.encar.com`** — 스키마/DOM 완전 다를 가능성.
- 🔲 **법인 소유 개인등록** 엣지 케이스 — `contact.userType='CLIENT'` 이면서 timeline 의 첫 이벤트가 `CORPORATION` 인 케이스가 실제로 있을지.

## 10. 파서 불변식 (Invariants)

> 다음 불변식을 어기면 파서는 실패로 처리한다. 권위 있는 버전은 `docs/design/DESIGN.md` §5.3 (F1–F5).

- **carId 파싱**: URL path 에서만 추출 (`/cars/detail/(\d+)`). 쿼리스트링 `carid=` 는 보조.
- **F1 법인 ≠ 렌트**: R05 는 `recordApi.loan/business/government` 정수만 사용. `release.flag==='CORPORATION'` 같은 힌트는 무시 (Sample 004 이 카나리아).
- **F2 사고 금액 정수**: `recordApi.myAccidentCost`/`otherAccidentCost` 만 사용. HTML insurance entry heuristic 파싱 금지.
- **F3 날짜 string 그대로**: `3000년 01월 16일` 같은 비정상값이 실제로 오기 때문에 strict parse 금지.
- **F4 login_required → UI**: `parse_failed('login_required')` 는 "로그인 후 재평가" CTA 로 노출. (현재는 R05~R10 전부 open 이라 실질 트리거 없음.)
- **F5 딜러 vs 개인 분기**: `isPersonalListing(base, flags)===true` 면 R03 을 `parse_failed('not_applicable_personal')` 로, R04 는 API 원천 부재로 `'not_derived'` 로 세팅 → 둘 다 `unknown` severity. R05~R10 은 recordApi 가 개인매물에도 반환되므로 그대로 동작. (Sample 006 이 카나리아.)
- **FetchStatus 구분**: HTTP 404 → `'no_report_for_personal'`, 401/403 → `'login_required'`, 5xx/network → `'api_fetch_error'`, not attempted → `'not_fetched'`. UI 에서 각각 다른 copy 로 노출.

---

**현재 상태**: MVP 가동 중. 딜러·개인매물 양쪽에서 11 룰 평가 확인. 후속 작업은 `docs/design/DESIGN.md` §11.3 (Phase 2 백로그) 참조.
