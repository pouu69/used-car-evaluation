import { describe, it, expect } from 'vitest';
import { mapVerdictLabel, buildVerdictSummary } from '../../src/sidepanel/lib/verdict.js';
import type { RuleResult } from '../../src/core/types/RuleTypes.js';

function makeResult(ruleId: string, title: string, severity: RuleResult['severity']): RuleResult {
  return { ruleId, title, severity, message: '', evidence: [], acknowledgeable: false };
}

describe('mapVerdictLabel', () => {
  it('maps NEVER', () => expect(mapVerdictLabel('NEVER')).toBe('DO NOT\nBUY.'));
  it('maps CAUTION', () => expect(mapVerdictLabel('CAUTION')).toBe('CAUTION.\nREAD ME.'));
  it('maps OK', () => expect(mapVerdictLabel('OK')).toBe('GOOD.'));
  it('maps UNKNOWN', () => expect(mapVerdictLabel('UNKNOWN')).toBe('CHECK\nTHIS.'));
});

describe('buildVerdictSummary', () => {
  it('returns 특이사항 없음 for empty input', () => {
    expect(buildVerdictSummary([], [])).toBe('특이사항 없음');
  });

  it('uses shortTitle from RULE_META for known ruleIds', () => {
    const killers = [makeResult('R04', 'Frame accident', 'killer')];
    const result = buildVerdictSummary(killers, []);
    expect(result).toBe('프레임 무사고');
  });

  it('falls back to r.title for unknown ruleIds', () => {
    const killers = [makeResult('R99', 'Unknown Rule', 'killer')];
    const result = buildVerdictSummary(killers, []);
    expect(result).toBe('Unknown Rule');
  });

  it('puts killers before warns', () => {
    const killers = [makeResult('R04', 'Frame', 'killer')];
    const warns = [makeResult('R05', 'Rental', 'warn')];
    const result = buildVerdictSummary(killers, warns);
    expect(result).toBe('프레임 무사고 · 렌트·택시 이력');
  });

  it('caps at 3 entries total (killers first)', () => {
    const killers = [
      makeResult('R04', 'Frame', 'killer'),
      makeResult('R06', 'Total loss', 'killer'),
    ];
    const warns = [
      makeResult('R05', 'Rental', 'warn'),
      makeResult('R07', 'Owner', 'warn'),
    ];
    const result = buildVerdictSummary(killers, warns);
    const parts = result.split(' · ');
    expect(parts.length).toBe(3);
    // First two should be killers
    expect(parts[0]).toBe('프레임 무사고');
    expect(parts[1]).toBe('전손·침수·도난');
    // Third should be first warn
    expect(parts[2]).toBe('렌트·택시 이력');
  });
});
