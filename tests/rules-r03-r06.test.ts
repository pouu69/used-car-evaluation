/**
 * R03 (엔카진단) + R06 (전손/침수/도난) 변경 검증.
 *
 * - R03: 엔카진단 미수검은 감점(killer)이 아니라 결과에서 빠져야 한다.
 * - R06: 전손/침수전손/침수분손/도난 개별 count를 메시지에 구체적으로 표기.
 */
import { describe, it, expect } from 'vitest';
import { r03, r06, evaluate } from '../src/core/rules/index.js';
import { value, failed } from '../src/core/types/FieldStatus.js';
import type { ChecklistFacts } from '../src/core/types/ChecklistFacts.js';

const baseFacts = (): ChecklistFacts => ({
  schemaVersion: 1,
  derivedFrom: 'encar',
  bridgeWarnings: [],
  insuranceHistoryDisclosed: value(true),
  inspectionReportDisclosed: value(true),
  hasEncarDiagnosis: value(true),
  frameDamage: value({ hasDamage: false }),
  usageHistory: value({ rental: false, taxi: false, business: false }),
  totalLossHistory: value({
    totalLoss: 0,
    floodTotal: 0,
    floodPart: 0,
    robber: 0,
  }),
  ownerChangeCount: value(1),
  insuranceGap: value({ hasGap: false, totalMonths: 0, periods: [] }),
  unconfirmedAccident: value(false),
  minorAccidents: value({ ownDamageWon: 0, otherDamageWon: 0, domestic: true }),
  priceVsMarket: value({ priceWon: 30_000_000, newPriceWon: 50_000_000, ratio: 0.6 }),
  oilLeak: value({ hasLeak: false, items: [] }),
});

describe('R03 엔카진단', () => {
  it('진단 있음 → pass', () => {
    const f = baseFacts();
    f.hasEncarDiagnosis = value(true);
    const res = r03(f);
    expect(res?.severity).toBe('pass');
  });

  it('진단 없음 → null (감점 아님, 결과에서 제외)', () => {
    const f = baseFacts();
    f.hasEncarDiagnosis = value(false);
    expect(r03(f)).toBeNull();
  });

  it('unknown → severity unknown', () => {
    const f = baseFacts();
    f.hasEncarDiagnosis = failed('not_derived');
    expect(r03(f)?.severity).toBe('unknown');
  });

  it('evaluate()에서 null은 results에서 제외된다', () => {
    const f = baseFacts();
    f.hasEncarDiagnosis = value(false);
    const report = evaluate(f);
    expect(report.results.find((r) => r.ruleId === 'R03')).toBeUndefined();
  });
});

describe('R06 전손/침수/도난', () => {
  it('이력 전무 → pass', () => {
    const res = r06(baseFacts());
    expect(res?.severity).toBe('pass');
    expect(res?.message).toContain('없습니다');
  });

  it('전손 1회 → killer + 메시지에 "전손 1회"', () => {
    const f = baseFacts();
    f.totalLossHistory = value({
      totalLoss: 1,
      floodTotal: 0,
      floodPart: 0,
      robber: 0,
    });
    const res = r06(f);
    expect(res?.severity).toBe('killer');
    expect(res?.message).toContain('전손 1회');
  });

  it('침수전손 2회 → 메시지에 "침수전손 2회"', () => {
    const f = baseFacts();
    f.totalLossHistory = value({
      totalLoss: 0,
      floodTotal: 2,
      floodPart: 0,
      robber: 0,
    });
    const res = r06(f);
    expect(res?.severity).toBe('killer');
    expect(res?.message).toContain('침수전손 2회');
  });

  it('침수분손 3회 → 메시지에 "침수분손 3회"', () => {
    const f = baseFacts();
    f.totalLossHistory = value({
      totalLoss: 0,
      floodTotal: 0,
      floodPart: 3,
      robber: 0,
    });
    const res = r06(f);
    expect(res?.severity).toBe('killer');
    expect(res?.message).toContain('침수분손 3회');
  });

  it('도난 1회 → 메시지에 "도난 1회"', () => {
    const f = baseFacts();
    f.totalLossHistory = value({
      totalLoss: 0,
      floodTotal: 0,
      floodPart: 0,
      robber: 1,
    });
    const res = r06(f);
    expect(res?.severity).toBe('killer');
    expect(res?.message).toContain('도난 1회');
  });

  it('전손 + 침수분손 복합 → 둘 다 메시지에 포함', () => {
    const f = baseFacts();
    f.totalLossHistory = value({
      totalLoss: 1,
      floodTotal: 0,
      floodPart: 2,
      robber: 0,
    });
    const res = r06(f);
    expect(res?.severity).toBe('killer');
    expect(res?.message).toContain('전손 1회');
    expect(res?.message).toContain('침수분손 2회');
  });

  it('killer일 때 title도 "전손/침수/도난 이력"으로 바뀐다', () => {
    const f = baseFacts();
    f.totalLossHistory = value({
      totalLoss: 1,
      floodTotal: 0,
      floodPart: 0,
      robber: 0,
    });
    const res = r06(f);
    expect(res?.title).toBe('전손/침수/도난 이력');
  });

  it('evaluate()에서 verdict가 NEVER로 간다', () => {
    const f = baseFacts();
    f.totalLossHistory = value({
      totalLoss: 1,
      floodTotal: 0,
      floodPart: 0,
      robber: 0,
    });
    const report = evaluate(f);
    expect(report.verdict).toBe('NEVER');
    expect(report.killers.map((k) => k.ruleId)).toContain('R06');
  });
});
