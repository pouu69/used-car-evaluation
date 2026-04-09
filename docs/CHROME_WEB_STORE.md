# AutoVerdict — Chrome Web Store 등록 체크리스트

이 문서는 Chrome Web Store Developer Dashboard에 업로드할 때 복사해 쓸 수 있는 원고 모음입니다.

Dashboard URL: https://chrome.google.com/webstore/devconsole

---

## 1. 패키지 생성

```bash
npm run package
# → autoverdict-<version>.zip 이 프로젝트 루트에 생성됩니다.
```

스크립트는 내부적으로 `npm run build` 후 `dist/`의 **내용물**만 ZIP으로 묶습니다 (manifest.json이 zip 루트에 있어야 Chrome 심사가 통과됩니다).

---

## 2. 스토어 등록 정보

### 이름 (Name)
```
AutoVerdict — 엔카 매물 자동 평가
```

### 짧은 설명 (Summary, 최대 132자)
```
엔카 중고차 매물을 11가지 핵심 룰로 자동 점검하고, 선택적으로 OpenAI/Gemini를 이용해 AI 종합 평가까지 받아보는 브루탈리스트 스코어보드.
```

### 상세 설명 (Description)

```
AutoVerdict는 엔카(Encar) 중고차 매물 상세 페이지를 열면 사이드패널에서 자동으로 매물을 평가해 주는 Chrome 확장입니다.

■ 무엇을 자동으로 확인하나요?
- 사고 이력 — 자차/타차 보험 처리 내역, 단순 교환/판금 여부
- 프레임/주요 골격 — 성능점검 리포트 기반 외판·골격 손상 신호
- 소유자 변경 횟수 — 빈번한 손바꿈 여부
- 자차보험 공백 — 미가입 구간 개월 수 계산
- 관용/대여/영업용 이력 — 과거 사용 이력 검증
- 시세 비교 — 동급 대비 과도한 가격 이탈
- 판매자 유형 — 개인 vs 딜러 구분
- 보험 처리 규모 — 국산 200만원 / 수입 400만원을 기준으로 경미/주의 분류
- 기타 투명성 신호

각 룰의 결과는 KILLER / WARN / PASS / N/A 4단계로 분류되어, 100점 만점의 총점과 함께 "DO NOT BUY / CAUTION / GOOD / CHECK THIS" 판정을 보여줍니다.

■ AI 종합 평가 (선택 기능)
사용자가 직접 OpenAI 또는 Google AI Studio API 키를 입력하면, 수집된 매물 데이터를 바탕으로 LLM이 장점 / 우려 / 협상 포인트 / 데이터 부족 항목을 요약합니다. API 키는 사이드패널이 열려 있는 동안 메모리에만 보관되며, 확장 내부 저장소에 기록되지 않습니다.

■ 디자인 — Brutalist Scoreboard
Archivo Black 디스플레이 타이포, 형광 옐로우와 블랙을 기반으로 한 브루탈리즘 UI. 얇은 회색 카드를 쌓는 대신, 두꺼운 경계선과 카테고리별 반전 색상으로 위험 신호를 한눈에 인지할 수 있습니다.

■ 개인정보
수집된 모든 매물 데이터는 사용자의 로컬 브라우저(IndexedDB)에만 저장됩니다. 확장 개발자의 서버는 존재하지 않으며, 외부 전송은 사용자가 직접 AI 평가를 실행할 때 해당 LLM API로 보내는 것이 유일합니다. 자세한 사항은 개인정보 처리방침 페이지를 참고하세요.

■ 지원 페이지
- https://fem.encar.com/cars/detail/*

다른 도메인에서는 동작하지 않으며, 엔카 이외의 사이트에 대한 접근 권한도 요구하지 않습니다.
```

### 카테고리 (Category)
```
Productivity  (또는 Shopping)
```

### 언어 (Language)
```
한국어 (Korean)
```

---

## 3. Single Purpose 설명 (필수)

Chrome Web Store는 "확장의 단일 목적"을 명확하게 기술하도록 요구합니다. 아래 문구를 Dashboard의 "Single purpose" 필드에 그대로 입력하면 됩니다.

```
엔카(fem.encar.com) 중고차 매물 상세 페이지를 볼 때, 해당 매물의 사고·이력·시세·
보험 처리 규모 등을 11가지 룰로 자동 점검하여 사이드패널에 체크리스트 형태로 표시
하는 것이 본 확장의 유일한 목적입니다.
```

---

## 4. Permissions Justification (필수)

각 권한별로 아래 문구를 "Permissions justification" 영역에 입력합니다.

### `storage`
```
매물별 평가 결과(룰 실행 결과, 점수, 판정)를 IndexedDB / chrome.storage.local에 캐싱
하여 동일 매물을 재방문할 때 네트워크 호출과 재계산을 생략하기 위해 사용합니다.
사용자의 개인 식별 정보는 저장하지 않습니다.
```

### `sidePanel`
```
평가 결과를 Chrome Side Panel UI로 표시하기 위해 필요합니다. 확장의 모든 사용자
인터페이스가 사이드패널 안에서 동작합니다.
```

### `cookies`
```
엔카 API(api.encar.com, fem.encar.com)가 요구하는 로그인 세션 쿠키를 그대로
사용하기 위해 필요합니다. 쿠키 값 자체를 읽거나 저장하지 않으며, 확장은 엔카
세션으로만 해당 API를 호출합니다.
```

### `alarms`
```
매물 평가 결과 캐시의 만료 시점을 주기적으로 정리(prune)하기 위해 사용합니다.
사용자에게 알림을 표시하는 용도는 아닙니다.
```

### `scripting`
```
엔카 매물 상세 페이지(fem.encar.com/cars/detail/*)에 파싱 스크립트를 주입하여
페이지 내 JSON 데이터를 추출하기 위해 필요합니다. 주입은 지정된 호스트 외에는
발생하지 않습니다.
```

### `tabs`
```
현재 활성 탭의 URL이 엔카 매물 상세 페이지 패턴(fem.encar.com/cars/detail/*)과
일치하는지 확인하기 위해 사용합니다. 탭의 제목·이동 기록·즐겨찾기 등은 읽지
않으며, 다른 탭의 내용을 들여다보지 않습니다.
```

### Host permissions (`https://fem.encar.com/*`, `https://car.encar.com/*`, `https://api.encar.com/*`)
```
엔카 매물 페이지에서 콘텐츠 스크립트를 실행하고, 엔카 API에서 차량 기본 정보 /
이력 / 사고 / 성능점검 리포트를 가져오기 위해 필요합니다. 엔카 이외의 도메인에는
어떠한 권한도 요구하지 않습니다.
```

---

## 5. 원격 코드(Remote Code) 사용 여부

Dashboard가 묻는 "Are you using remote code?" 질문에는 **"No, I am not using Remote code"** 를 선택하면 됩니다. 모든 JavaScript는 ZIP 패키지 안에 번들되어 있으며, 런타임에 외부 스크립트를 내려받거나 eval 하지 않습니다.

LLM API 호출(선택 기능)은 사용자가 직접 입력한 API 키로 `fetch()` 호출을 하는 것이며, 원격 JavaScript 실행과는 구분되는 데이터 전송이므로 "Remote code"에 해당하지 않습니다.

---

## 6. Privacy Policy URL

Dashboard의 "Privacy policy" 필드에는 `docs/PRIVACY.md`를 공개 URL 형태로 호스팅한 주소를 넣어야 합니다. 권장 호스팅 방법:

1. GitHub 저장소를 public으로 공개 → `docs/PRIVACY.md` 링크 사용
2. GitHub Pages 활성화 → `https://<username>.github.io/<repo>/PRIVACY.html`
3. Notion 공개 페이지에 내용 복사 → "공유 → 웹에 게시"로 URL 발급

어떤 방법을 쓰든 **수정되지 않는 영구 URL**이어야 합니다 (심사에서 종종 지적됩니다).

---

## 7. Data Use Disclosures

Dashboard의 "Privacy practices" 탭에서 수집 데이터 유형을 체크하는 UI가 있습니다. 다음 항목만 체크하세요.

- [x] **Website content** — 엔카 매물 페이지의 공개 정보 (차량 사양 / 이력 / 점검 리포트)

그 외 (Personally identifiable information, Health info, Financial info, Authentication info, Personal communications, Location, Web history, User activity, Website content 외 항목)은 모두 **체크하지 않음**.

그리고 아래 세 문항에 대해 모두 **동의(attest)** 해야 합니다.

1. 수집된 데이터는 승인된 용도(매물 평가) 이외로 사용되거나 이전되지 않습니다.
2. 수집된 데이터는 승인된 용도 이외에 판매되거나 공유되지 않습니다.
3. 수집된 데이터는 신용 상태 결정 또는 대출 목적으로 사용/이전되지 않습니다.

---

## 8. 업로드 전 로컬 검증

```bash
npm run package            # autoverdict-<version>.zip 생성
unzip -l autoverdict-*.zip | head -20   # manifest.json이 최상단에 있는지 확인
```

Chrome에서 수동 로드:
1. `chrome://extensions` 이동
2. 오른쪽 상단 "개발자 모드" ON
3. "압축해제된 확장 프로그램 로드" → `dist/` 폴더 선택
4. 엔카 매물 상세 페이지를 열고 사이드패널이 정상 동작하는지 확인
5. AI 평가 탭에서 API 키 입력 → "RUN AI EVALUATION" 동작 확인

---

## 9. 제출 후 예상 일정

- **첫 심사**: 보통 1~3 영업일
- **거절 시**: Dashboard의 "Violations" 섹션에 사유가 안내되며, 동일 ZIP에 수정본을 덮어쓰기 업로드 가능
- **승인 후**: 공개 전환까지 수 시간 이내

가장 흔한 거절 사유:
1. Privacy Policy URL이 접근 불가능하거나 내용이 부실 → §6 확인
2. Single purpose 설명이 모호 → §3 문구 그대로 사용
3. 사용하지 않는 권한을 manifest에 선언 → 현재 권한 리스트는 실제 코드에서 모두 사용 중
4. 스크린샷이 확장 UI와 불일치 → 실제 UI 캡처 사용
