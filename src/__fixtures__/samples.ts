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

// ── Sample 006: BMW G30 개인매물 (CLIENT) — R08 KILLER + R10 WARN ──
// First personal (non-dealer) fixture. Proves that R03 must NOT fire as a
// KILLER on personal listings (they cannot get Encar diagnosis). Mirrors
// docs/discovery/encar/samples/006-bmw-g30-530i-individual-seller.md.
export const sample006: EncarParsedData = {
  schemaVersion: 1,
  source: 'encar',
  url: 'https://fem.encar.com/cars/detail/41707401',
  carId: '41707401',
  vehicleId: 41707401,
  vehicleNo: '20소5501',
  fetchedAt: ts,
  loginState: 'logged_in',
  raw: {
    base: value({
      category: {
        manufacturerName: 'BMW',
        modelGroupName: '5시리즈',
        modelName: '5시리즈 (G30)',
        gradeName: '530i xDrive M 스포츠 플러스',
        yearMonth: '201706',
        formYear: '2017',
        newPrice: 7480,
        domestic: false,
        importType: 'NONE_IMPORT_TYPE',
      },
      advertisement: {
        price: 2250,
        preVerified: false,
        trust: [],
        diagnosisCar: false,
        advertisementType: 'NORMAL',
      },
      spec: {
        mileage: 105_000,
        fuelName: '가솔린',
        tradeType: null, // personal listing — NOT 'I'
      },
      contact: {
        address: '대구 남구',
        userType: 'CLIENT', // ← the personal-listing discriminator
        isVerifyOwner: true,
        isOwnerPartner: false,
      },
      partnership: {
        dealer: null,
        isPartneredVehicle: false,
      },
      vin: null,
    }),
    detailFlags: value({
      isInsuranceExist: true,
      isHistoryView: true,
      isDiagnosisExist: false, // would normally KILLER R03 — but personal path skips
      isDealer: false, // ← the primary discriminator
    }),
    recordApi: value(
      emptyRecord({
        // recordApi IS available for personal listings (verified via live
        // Playwright hit on carId=41707401). Only diagnosis/inspection 404.
        loan: 0,
        business: 0,
        government: 0,
        ownerChangeCnt: 3,
        myAccidentCnt: 4,
        otherAccidentCnt: 2,
        myAccidentCost: 16_740_000, // 1,674만원 — 매가의 74%
        otherAccidentCost: 1_200_000,
        notJoinDate1: '202011~202012',
        notJoinDate2: '202412~202501',
        accidentCnt: 6,
      }),
    ),
    diagnosisApi: { kind: 'parse_failed', reason: 'no_report_for_personal' },
    inspectionApi: { kind: 'parse_failed', reason: 'no_report_for_personal' },
  },
};

// ── Synthetic personal-listing PASS sample — same brand, clean ledger ─
// Used to prove that an otherwise-ideal personal listing verdicts as
// UNKNOWN (not OK — R03 is unknown, not pass) and never triggers R03/R04
// as a killer. If this ever verdict to NEVER we have a regression.
export const samplePersonalClean: EncarParsedData = {
  schemaVersion: 1,
  source: 'encar',
  url: 'https://fem.encar.com/cars/detail/99999999',
  carId: '99999999',
  vehicleId: 99999999,
  vehicleNo: '99가9999',
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
      advertisement: { price: 2200, preVerified: false, trust: [] },
      spec: { mileage: 8_000, tradeType: null },
      contact: { userType: 'CLIENT', isVerifyOwner: true },
    }),
    detailFlags: value({
      isInsuranceExist: true,
      isHistoryView: true,
      isDiagnosisExist: false,
      isDealer: false,
    }),
    recordApi: value(emptyRecord()),
    diagnosisApi: { kind: 'parse_failed', reason: 'no_report_for_personal' },
    inspectionApi: { kind: 'parse_failed', reason: 'no_report_for_personal' },
  },
};

// ── Sample 007: BMW F30 320i (dealer, no diagnosis, rent history) ──
// First sample exercising the inspectionApi → R04 path. Dealer listing
// without Encar diagnosis, but with a government 성능점검 report that
// reports `accdient=false, simpleRepair=true`. R04 must resolve to PASS
// via the inspection layer (NOT the ribbon, which requires
// isDiagnosisExist=true). Verdict is still NEVER from R05/R08.
// Source: docs/discovery/encar/samples/007-bmw-f30-320i-rent-history.md
export const sample007: EncarParsedData = {
  schemaVersion: 1,
  source: 'encar',
  url: 'https://fem.encar.com/cars/detail/41769443',
  carId: '41769443',
  vehicleId: 41769443,
  vehicleNo: '174무1429',
  fetchedAt: ts,
  loginState: 'logged_in',
  raw: {
    base: value({
      category: {
        manufacturerName: 'BMW',
        modelName: '3시리즈 (F30)',
        gradeName: '320i M 스포츠',
        yearMonth: '201803',
        formYear: '2018',
        newPrice: 4970,
        domestic: false,
        importType: 'NONE_IMPORT_TYPE',
      },
      advertisement: {
        price: 1699,
        preVerified: false,
        trust: [],
        diagnosisCar: false,
        advertisementType: 'NORMAL',
        oneLineText: '엔카 실촬영',
      },
      spec: { mileage: 81_922, fuelName: '가솔린', tradeType: 'D' },
      contact: {
        userType: 'DEALER',
        isVerifyOwner: false,
        isOwnerPartner: true,
      },
      partnership: { isPartneredVehicle: true },
      vin: 'WBA8A9108JAE91643',
    }),
    detailFlags: value({
      isInsuranceExist: true,
      isHistoryView: true,
      isDiagnosisExist: false, // ← ribbon fallback NOT available
      isDealer: true,
    }),
    recordApi: value(
      emptyRecord({
        loan: 1, // first observed positive loan
        ownerChangeCnt: 5,
        myAccidentCnt: 2,
        otherAccidentCnt: 3,
        myAccidentCost: 2_141_500,
        otherAccidentCost: 16_054_570,
        notJoinDate1: '202108~202109',
        notJoinDate2: '202409~202502',
        accidentCnt: 5,
      }),
    ),
    diagnosisApi: { kind: 'parse_failed', reason: 'not_fetched' },
    // The whole point of this fixture: inspection says "no frame accident".
    inspectionApi: value({
      vehicleId: 41769443,
      master: {
        accdient: false, // (sic) — API returns this typo
        simpleRepair: true, // outer-panel bolt-on replacement only
        detail: { waterlog: false, recall: false, tuning: false },
      },
    }),
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
