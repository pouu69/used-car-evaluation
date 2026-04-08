# 구현 계획 리뷰 v1

**Reviewer**: self (main agent)
**Target**: [IMPLEMENTATION.md](./IMPLEMENTATION.md)
**Input baseline**: [docs/discovery/encar/README.md](../discovery/encar/README.md)

## 결론
**APPROVED with minor fixes** — 바로 구현 착수 가능. 아래 이슈는 구현 중 해결.

---

## 1. 갭 분석 (Discovery ↔ Plan)

| 항목 | Discovery 정의 | Plan 반영 | 상태 |
|---|---|---|---|
| 5 데이터 소스 (S1~S6) | O | §4 파이프라인에 반영 | ✅ |
| AI-free 원칙 | O | §0 재확인 | ✅ |
| FieldStatus 5상태 | O | §3.1 | ✅ |
| Dual-parser (state + DOM) | O | `state.ts` + `dom.ts` | ✅ |
| 법인≠렌트 (Sample 004 교훈) | O | §3/Bridge 에서 `driveCaution.rent` 직접 사용 명시 필요 | 🟡 |
| `insurance[].contents[].type` 구분 | O | Bridge 에서 `type='insurance'` 만 카운트 해야 함 — plan 에 명시 부족 | 🟡 |
| 비정상 날짜 (3000년) | O | Zod 에서 `z.string()` 유지 — plan 에 명시 부족 | 🟡 |
| 로그인 state machine | O | `loginState` 필드만 있고 감지 로직 미상세 | 🟡 |
| R12 리콜 / R13 노후 | 부가 제안 | plan 에서 누락 | 🔴 |
| 시세 외부 API (R11) | 미확보 | §11 리스크에 기재됨 | ✅ |

### Fix (Stage 4 착수 시 반영)
- **F1**: Bridge 문서/코드에 "법인 flag는 `rent` 판정에 쓰지 않는다" 불변식 주석
- **F2**: `type` 필터링 불변식을 bridge 단위 테스트로 강제
- **F3**: Zod 스키마에 `dateStringLoose = z.string()` helper 도입, 후처리 파싱 분리
- **F4**: `loginState` 감지 로직 — S3/S6 응답에서 `로그인 후 확인` 문구 regex + 쿠키 확인 병행
- **F5**: MVP 룰 11개로 제한하고 R12/R13은 **Phase 2 백로그**로 명시 (scope creep 방지)

## 2. 스코프 현실성

- 파서 5종 + 브리지 + 룰 11개 + UI + 저장소 + 메시징 → **MVP 범위로는 넓음**.
- 완화: **Phase별 verify gate** 가 있어 각 단계별 정지/재조정 가능.
- **컷**: E2E Playwright (Phase 2 후순위로 이동), popup 모드 (side panel 만), debug 탭 (개발 전용).

## 3. 리스크 재평가

| 리스크 | 영향 | 대응 |
|---|---|---|
| @crxjs/vite-plugin 2 beta 호환성 | 빌드 실패 | Phase 1 verify gate — 실패 시 `vite-plugin-web-extension` fallback |
| Tailwind 4 oklch 렌더링 | UI 깨짐 | Chrome 120+ 만 지원 선언 |
| S3~S6 fetch CORS | 수집 실패 | manifest `host_permissions` + service worker `credentials:include` — Phase 5 smoke test |
| 긍정 PASS 샘플 부재 | 룰 테스트 불완전 | **합성 fixture** 작성 (§11 반영됨) |
| DOM 구조 변경 | 파서 파손 | 안정 앵커만 사용 + fixture 회귀 테스트로 조기 감지 |
| 로그인 쿠키 이름 미확정 | 상태 오판 | 쿠키보단 **fetch 응답 바디에서 로그인 문구 감지** 우선 |

## 4. 계층 분리 검증

- `rules/` → `facts` 만 참조 ✅ (pure)
- `bridge/` → `parsed` → `facts` 만 ✅ (pure)
- `parsers/` → DOM/JSON 만 ✅
- `storage/` → Dexie 만 ✅
- `ui/` → 상위 레이어 소비자 ✅
- 메시징 is orthogonal ✅

→ 단방향 의존성 그래프 유지됨.

## 5. 테스트 전략 현실성

- 4 샘플의 `__PRELOADED_STATE__` / `__NEXT_DATA__` 를 **실제로 복원 가능한가?** → 이전 세션에서 Playwright 로 캡처했으나 **파일로는 저장 안 됨**. Phase 3 착수 시 현재 세션 혹은 사용자의 재방문으로 재캡처 필요.
- **대안**: 디스커버리 문서의 스키마 + 필드값을 근거로 **수작업 fixture** 작성 (실제 응답의 최소 재구성). 이것이 오히려 테스트 가독성에 유리.

### Fix
- **F6**: Phase 3-0 "fixture 수작업 작성" 서브태스크 추가 — 4 샘플별 최소 JSON 재구성.

## 6. DoD 적절성

§12 DoD 항목들은 **검증 가능**하고 **구체적**. 다만 추가:
- **F7**: "manifest.json 보안 리뷰 완료 (최소 권한)" 추가
- **F8**: "사용자 로그인 안내 UX 구현" 명시적 DoD

## 7. 최종 Fix 목록 (구현 시 반영)

1. F1: 법인≠렌트 불변식 주석/테스트
2. F2: insurance.type 필터 테스트
3. F3: `dateStringLoose` Zod helper
4. F4: `loginState` 감지 — fetch 응답 우선
5. F5: R12/R13 백로그 이동 명시
6. F6: Phase 3-0 수작업 fixture 작성 서브태스크
7. F7: 최소권한 manifest 리뷰 DoD
8. F8: 로그인 유도 UX DoD

## 8. 승인

위 8개 fix 는 **구현 중 인라인 수정** 하는 것이 문서를 다시 고치는 것보다 효율적이므로, **Stage 4 착수 승인** 한다. 단, Phase 3 시작 전 F6 (fixture 복원 전략) 결정 선행.
