/**
 * Smoke test for the parser orchestrator.
 */
import { describe, it, expect } from 'vitest';
import { orchestrate } from '../src/core/parsers/encar/index.js';
import { encarToFacts } from '../src/core/bridge/encar-to-facts.js';
import { evaluate } from '../src/core/rules/index.js';

describe('orchestrate', () => {
  it('builds parsed data from state + API JSON', () => {
    const parsed = orchestrate({
      url: 'https://fem.encar.com/cars/detail/12345',
      carId: '12345',
      preloadedRoot: {
        __PRELOADED_STATE__: {
          cars: {
            base: {
              category: {
                manufacturerName: '현대',
                modelName: 'X',
                yearMonth: '202401',
                newPrice: 2500,
                domestic: true,
              },
              advertisement: { price: 2200, preVerified: true, trust: [] },
              spec: { mileage: 10000 },
              vehicleId: 12345,
              vehicleNo: '00가0000',
            },
            detailFlags: {
              isInsuranceExist: true,
              isHistoryView: true,
              isDiagnosisExist: true,
            },
          },
        },
      },
      recordJson: {
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
      },
      diagnosisJson: {
        vehicleId: 12345,
        items: [
          {
            code: '006039',
            name: 'CHECKER_COMMENT',
            result: "모든 항목이 정상으로 확인되며, '무사고' 차량으로 판정합니다.",
            resultCode: null,
          },
        ],
      },
      loginState: 'logged_in',
    });
    expect(parsed.raw.base.kind).toBe('value');
    expect(parsed.raw.detailFlags.kind).toBe('value');
    expect(parsed.raw.recordApi.kind).toBe('value');
    expect(parsed.raw.diagnosisApi.kind).toBe('value');

    const report = evaluate(encarToFacts(parsed));
    expect(report.verdict).toBe('OK');
    expect(report.killers.length).toBe(0);
  });

  it('returns parse_failed for missing preloaded state', () => {
    const parsed = orchestrate({
      url: 'https://fem.encar.com/cars/detail/99',
      carId: '99',
      preloadedRoot: null,
    });
    expect(parsed.raw.base.kind).toBe('parse_failed');
    expect(parsed.raw.recordApi.kind).toBe('parse_failed');
  });
});
