import { describe, it, expect } from 'vitest';
import { computeRadarAxes } from '../../src/sidepanel/lib/radar.js';
import { CATEGORY_ORDER } from '../../src/sidepanel/rule-meta.js';
import type { RuleResult } from '../../src/core/types/RuleTypes.js';

function makeResult(ruleId: string, severity: RuleResult['severity']): RuleResult {
  return { ruleId, title: ruleId, severity, message: '', evidence: [], acknowledgeable: false };
}

describe('computeRadarAxes', () => {
  it('returns 5 axes for empty input, all zeros', () => {
    const axes = computeRadarAxes([]);
    expect(axes.length).toBe(5);
    for (const ax of axes) {
      expect(ax.pass).toBe(0);
      expect(ax.total).toBe(0);
      expect(ax.pct).toBe(0);
    }
  });

  it('output order matches CATEGORY_ORDER exactly', () => {
    const axes = computeRadarAxes([]);
    expect(axes.map(a => a.category)).toEqual(CATEGORY_ORDER);
  });

  it('computes pct=33 for 이력 with 1 pass out of 3', () => {
    // R05=이력 pass, R06=이력 warn, R07=이력 killer
    const results = [
      makeResult('R05', 'pass'),
      makeResult('R06', 'warn'),
      makeResult('R07', 'killer'),
    ];
    const axes = computeRadarAxes(results);
    const rekHistoryAxis = axes.find(a => a.category === '이력');
    expect(rekHistoryAxis).toBeDefined();
    expect(rekHistoryAxis!.total).toBe(3);
    expect(rekHistoryAxis!.pass).toBe(1);
    expect(rekHistoryAxis!.pct).toBe(33);
  });

  it('unknown ruleId falls back to 투명성 category', () => {
    const results = [makeResult('RXXX', 'pass')];
    const axes = computeRadarAxes(results);
    const transparencyAxis = axes.find(a => a.category === '투명성');
    expect(transparencyAxis).toBeDefined();
    expect(transparencyAxis!.total).toBe(1);
    expect(transparencyAxis!.pass).toBe(1);
  });

  it('100 pct when all pass', () => {
    const results = [
      makeResult('R01', 'pass'),
      makeResult('R02', 'pass'),
    ];
    const axes = computeRadarAxes(results);
    const transparencyAxis = axes.find(a => a.category === '투명성');
    expect(transparencyAxis!.pct).toBe(100);
  });

  it('0 pct when none pass', () => {
    const results = [makeResult('R11', 'killer')];
    const axes = computeRadarAxes(results);
    const priceAxis = axes.find(a => a.category === '가격');
    expect(priceAxis!.total).toBe(1);
    expect(priceAxis!.pass).toBe(0);
    expect(priceAxis!.pct).toBe(0);
  });
});
