/**
 * Unit tests for low-level parsers that survive the API pivot.
 * HTML scraping parsers (dom.ts, *-report.ts, history.ts) have been deleted
 * in favor of the structured api.encar.com JSON endpoints.
 */
import { describe, it, expect } from 'vitest';
import {
  extractBase,
  extractDetailFlags,
} from '../src/core/parsers/encar/state.js';
import {
  parseRecordApi,
  getInsuranceGapPeriods,
} from '../src/core/parsers/encar/api-record.js';
import {
  parseDiagnosisApi,
  getFrameIntact,
} from '../src/core/parsers/encar/api-diagnosis.js';
import { parseInspectionApi } from '../src/core/parsers/encar/api-inspection.js';
import { wonToNumber, splitLines } from '../src/core/parsers/utils/text.js';

describe('text utils', () => {
  it('parses 만원 and 원 amounts', () => {
    expect(wonToNumber('3만원')).toBe(30_000);
    expect(wonToNumber('8,977,290원')).toBe(8_977_290);
    expect(wonToNumber('garbage')).toBeUndefined();
  });
  it('splits lines and trims', () => {
    expect(splitLines('  a\n\n b \nc')).toEqual(['a', 'b', 'c']);
  });
});

describe('state.ts extractors', () => {
  it('extracts base + detailFlags from __PRELOADED_STATE__', () => {
    const root = {
      __PRELOADED_STATE__: {
        cars: {
          base: { category: { manufacturerName: 'X' }, vehicleId: 123 },
          detailFlags: { isDiagnosisExist: true },
        },
      },
    };
    expect(extractBase(root).kind).toBe('value');
    expect(extractDetailFlags(root).kind).toBe('value');
  });

  it('falls back to __NEXT_DATA__ when __PRELOADED_STATE__ missing', () => {
    const root = {
      __NEXT_DATA__: {
        props: {
          pageProps: {
            cars: { base: { category: { manufacturerName: 'Y' } } },
          },
        },
      },
    };
    expect(extractBase(root).kind).toBe('value');
  });

  it('returns parse_failed when nothing is available', () => {
    expect(extractBase({}).kind).toBe('parse_failed');
  });
});

describe('parseRecordApi', () => {
  it('accepts a well-formed record payload', () => {
    const json = {
      myAccidentCnt: 5,
      otherAccidentCnt: 1,
      ownerChangeCnt: 0,
      robberCnt: 0,
      totalLossCnt: 0,
      floodTotalLossCnt: 0,
      floodPartLossCnt: null,
      government: 0,
      business: 0,
      loan: 0,
      carNoChangeCnt: 0,
      myAccidentCost: 16_067_410,
      otherAccidentCost: 1_357_999,
      notJoinDate1: '202508~202512',
      notJoinDate2: null,
      notJoinDate3: null,
      notJoinDate4: null,
      notJoinDate5: null,
      accidentCnt: 6,
      accidents: [],
    };
    const r = parseRecordApi(json);
    expect(r.kind).toBe('value');
    if (r.kind !== 'value') return;
    expect(r.value.ownerChangeCnt).toBe(0);
    expect(r.value.myAccidentCost).toBe(16_067_410);
  });

  it('rejects empty payload', () => {
    expect(parseRecordApi(null).kind).toBe('parse_failed');
    expect(parseRecordApi({}).kind).toBe('parse_failed');
  });

  it('extracts insurance gap periods', () => {
    const periods = getInsuranceGapPeriods({
      notJoinDate1: '202508~202512',
      notJoinDate2: '202601~202603',
      notJoinDate3: null,
      notJoinDate4: null,
      notJoinDate5: null,
    } as Parameters<typeof getInsuranceGapPeriods>[0]);
    expect(periods).toEqual([
      { from: '2025-08', to: '2025-12' },
      { from: '2026-01', to: '2026-03' },
    ]);
  });

  it('returns empty list when no gap periods are set', () => {
    const periods = getInsuranceGapPeriods({
      notJoinDate1: null,
      notJoinDate2: null,
      notJoinDate3: null,
      notJoinDate4: null,
      notJoinDate5: null,
    } as Parameters<typeof getInsuranceGapPeriods>[0]);
    expect(periods).toEqual([]);
  });
});

describe('parseDiagnosisApi / getFrameIntact', () => {
  it('detects 무사고 from CHECKER_COMMENT', () => {
    const r = parseDiagnosisApi({
      vehicleId: 1,
      items: [
        {
          code: '006039',
          name: 'CHECKER_COMMENT',
          result: "본 차량은 엔카의 진단 결과 모든 항목이 정상으로 확인되며, '무사고' 차량으로 판정합니다.",
          resultCode: null,
        },
      ],
    });
    if (r.kind !== 'value') throw new Error('expected value');
    expect(getFrameIntact(r.value)).toBe(true);
  });

  it('detects 사고 from CHECKER_COMMENT', () => {
    const r = parseDiagnosisApi({
      vehicleId: 1,
      items: [
        {
          code: '006039',
          name: 'CHECKER_COMMENT',
          result: '본 차량은 사고 차량으로 판정합니다.',
          resultCode: null,
        },
      ],
    });
    if (r.kind !== 'value') throw new Error('expected value');
    expect(getFrameIntact(r.value)).toBe(false);
  });

  it('rejects empty payload', () => {
    expect(parseDiagnosisApi(null).kind).toBe('parse_failed');
    expect(parseDiagnosisApi({ items: 'not-array' }).kind).toBe('parse_failed');
  });
});

describe('parseInspectionApi', () => {
  it('accepts minimal inspection payload', () => {
    const r = parseInspectionApi({
      vehicleId: 1,
      master: { simpleRepair: true, detail: { mileage: 12000 } },
    });
    expect(r.kind).toBe('value');
  });

  it('rejects empty payload', () => {
    expect(parseInspectionApi(null).kind).toBe('parse_failed');
  });
});
