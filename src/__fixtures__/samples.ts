/**
 * Hand-crafted fixtures based on docs/discovery/encar/samples/*.md.
 * Each fixture is the *minimum* shape needed to drive the
 * parser → bridge → rule pipeline to the documented verdict.
 *
 * All fields match the post-API-pivot EncarParsedData shape: base + detailFlags +
 * recordApi + diagnosisApi + inspectionApi.
 */
import type { EncarParsedData } from '../core/types/ParsedData.js';
import type { RecordApi } from '../core/parsers/encar/api-record.js';
import { failed, value } from '../core/types/FieldStatus.js';

const ts = 1_700_000_000_000;

const emptyRecord = (overrides: Partial<RecordApi> = {}): RecordApi => ({
  myAccidentCnt: 0,
  otherAccidentCnt: 0,
  ownerChangeCnt: 0,
  robberCnt: 0,
  totalLossCnt: 0,
  floodTotalLossCnt: 0,
  floodPartLossCnt: null,
  government: 0,
  business: 0,
  loan: 0,
  carNoChangeCnt: 0,
  myAccidentCost: 0,
  otherAccidentCost: 0,
  notJoinDate1: null,
  notJoinDate2: null,
  notJoinDate3: null,
  notJoinDate4: null,
  notJoinDate5: null,
  accidentCnt: 0,
  accidents: [],
  openData: true,
  ...overrides,
});

const intactDiagnosis = {
  vehicleId: 0,
  items: [
    {
      code: '006039',
      name: 'CHECKER_COMMENT',
      result: "본 차량은 엔카의 진단 결과 모든 항목이 정상으로 확인되며, '무사고' 차량으로 판정합니다.",
      resultCode: null,
    },
  ],
};

// ── Sample 001: 스포티지 5세대 — R05+R08 KILLER ─────────────────
export const sample001: EncarParsedData = {
  schemaVersion: 1,
  source: 'encar',
  url: 'https://fem.encar.com/cars/detail/41623743',
  carId: '41623743',
  vehicleId: 41623743,
  vehicleNo: '155우6124',
  fetchedAt: ts,
  loginState: 'logged_in',
  raw: {
    base: value({
      category: {
        manufacturerName: '기아',
        modelName: '스포티지 5세대',
        gradeName: '디젤 2.0 4WD',
        gradeDetailName: '프레스티지',
        yearMonth: '202111',
        newPrice: 3044,
        domestic: true,
      },
      advertisement: { price: 2100, preVerified: true, trust: ['Warranty'] },
      spec: { mileage: 109_217 },
      vehicleNo: '155우6124',
    }),
    detailFlags: value({
      isInsuranceExist: true,
      isHistoryView: true,
      isDiagnosisExist: true,
    }),
    recordApi: value(
      emptyRecord({
        loan: 1,
        ownerChangeCnt: 2,
        notJoinDate1: '202111~202512',
      }),
    ),
    diagnosisApi: value(intactDiagnosis),
    inspectionApi: { kind: 'parse_failed', reason: 'not_fetched' },
  },
};

// ── Sample 002: 팰리세이드 — R03+R05+R08 KILLER ─────────────────
export const sample002: EncarParsedData = {
  schemaVersion: 1,
  source: 'encar',
  url: 'https://fem.encar.com/cars/detail/41709800',
  carId: '41709800',
  fetchedAt: ts,
  loginState: 'logged_in',
  raw: {
    base: value({
      category: {
        manufacturerName: '현대',
        modelName: '더 뉴 팰리세이드',
        gradeName: '가솔린 3.8 4WD',
        gradeDetailName: '캘리그래피',
        yearMonth: '202302',
        newPrice: 5309,
        domestic: true,
      },
      advertisement: { price: 4120, preVerified: false, trust: [] },
      spec: { mileage: 33_366 },
    }),
    detailFlags: value({
      isInsuranceExist: true,
      isHistoryView: true,
      isDiagnosisExist: false,
    }),
    recordApi: value(
      emptyRecord({
        loan: 1,
        ownerChangeCnt: 2,
        myAccidentCnt: 1,
        myAccidentCost: 380_000,
        notJoinDate1: '202302~202601',
      }),
    ),
    diagnosisApi: { kind: 'parse_failed', reason: 'not_fetched' },
    inspectionApi: { kind: 'parse_failed', reason: 'not_fetched' },
  },
};

// ── Sample 003: 팰리세이드 2.2 — R03+R05+R08 KILLER + R10 WARN ──
export const sample003: EncarParsedData = {
  schemaVersion: 1,
  source: 'encar',
  url: 'https://fem.encar.com/cars/detail/41762441',
  carId: '41762441',
  fetchedAt: ts,
  loginState: 'logged_in',
  raw: {
    base: value({
      category: {
        manufacturerName: '현대',
        modelName: '팰리세이드',
        gradeName: '디젤 2.2 2WD 캘리그래피',
        yearMonth: '202201',
        newPrice: 4774,
        domestic: true,
      },
      advertisement: { price: 3350, preVerified: false, trust: [] },
      spec: { mileage: 74_816, tradeType: 'D' },
    }),
    detailFlags: value({
      isInsuranceExist: true,
      isHistoryView: true,
      isDiagnosisExist: false,
    }),
    recordApi: value(
      emptyRecord({
        loan: 1,
        ownerChangeCnt: 1,
        otherAccidentCnt: 1,
        otherAccidentCost: 2_570_000,
        notJoinDate1: '202201~202301',
      }),
    ),
    diagnosisApi: { kind: 'parse_failed', reason: 'not_fetched' },
    inspectionApi: { kind: 'parse_failed', reason: 'not_fetched' },
  },
};

// ── Sample 004: BMW E90 328i — R08 KILLER + R10 WARN (법인≠렌트) ──
export const sample004: EncarParsedData = {
  schemaVersion: 1,
  source: 'encar',
  url: 'https://fem.encar.com/cars/detail/41529631',
  carId: '41529631',
  fetchedAt: ts,
  loginState: 'logged_in',
  raw: {
    base: value({
      category: {
        manufacturerName: 'BMW',
        modelName: '3시리즈 (E90)',
        gradeName: '328i 세단',
        yearMonth: '200712',
        newPrice: 6390,
        domestic: false,
        importType: 'REGULAR_IMPORT',
      },
      advertisement: { price: 290, preVerified: false, trust: ['Warranty'] },
      spec: { mileage: 213_892 },
      vin: 'WBAVA31057KM60091',
    }),
    detailFlags: value({
      isInsuranceExist: true,
      isHistoryView: true,
      isDiagnosisExist: true,
    }),
    recordApi: value(
      emptyRecord({
        // Corporate-owned but NOT a rental — invariant F1 proves 법인≠렌트.
        loan: 0,
        ownerChangeCnt: 4,
        myAccidentCnt: 9,
        otherAccidentCnt: 6,
        myAccidentCost: 8_977_290,
        otherAccidentCost: 2_332_154,
        notJoinDate1: '200712~200912',
      }),
    ),
    diagnosisApi: value(intactDiagnosis),
    inspectionApi: { kind: 'parse_failed', reason: 'not_fetched' },
  },
};

// ── Synthetic ideal PASS sample ─────────────────────────────────
export const sampleIdeal: EncarParsedData = {
  schemaVersion: 1,
  source: 'encar',
  url: 'https://fem.encar.com/cars/detail/00000000',
  carId: '00000000',
  fetchedAt: ts,
  loginState: 'logged_in',
  raw: {
    base: value({
      category: {
        manufacturerName: '현대',
        modelName: '아반떼',
        yearMonth: '202401',
        newPrice: 2500,
        domestic: true,
      },
      advertisement: { price: 2200, preVerified: true, trust: ['Warranty'] },
      spec: { mileage: 12_000 },
    }),
    detailFlags: value({
      isInsuranceExist: true,
      isHistoryView: true,
      isDiagnosisExist: true,
    }),
    recordApi: value(emptyRecord()),
    diagnosisApi: value(intactDiagnosis),
    inspectionApi: { kind: 'parse_failed', reason: 'not_fetched' },
  },
};
