/**
 * End-to-end pipeline test:
 * EncarParsedData fixture → bridge → rule engine → expected verdict.
 *
 * Verdicts mirror docs/discovery/encar/samples/*.md.
 */
import { describe, it, expect } from 'vitest';
import { encarToFacts } from '../src/core/bridge/encar-to-facts.js';
import { evaluate } from '../src/core/rules/index.js';
import {
  sample001,
  sample002,
  sample003,
  sample004,
  sampleIdeal,
} from '../src/__fixtures__/samples.js';

const triggered = (report: ReturnType<typeof evaluate>, ids: string[]) => {
  const set = new Set(report.killers.map((r) => r.ruleId));
  return ids.every((id) => set.has(id));
};

describe('integration: parsed → facts → verdict', () => {
  it('Sample 001 (스포티지) → NEVER (R05, R08)', () => {
    const facts = encarToFacts(sample001);
    const report = evaluate(facts);
    expect(report.verdict).toBe('NEVER');
    expect(triggered(report, ['R05', 'R08'])).toBe(true);
  });

  it('Sample 002 (팰리세이드) → NEVER (R03, R05, R08)', () => {
    const facts = encarToFacts(sample002);
    const report = evaluate(facts);
    expect(report.verdict).toBe('NEVER');
    expect(triggered(report, ['R03', 'R05', 'R08'])).toBe(true);
  });

  it('Sample 003 (팰리세이드 2.2) → NEVER (R03, R05, R08) + R10 warn', () => {
    const facts = encarToFacts(sample003);
    const report = evaluate(facts);
    expect(report.verdict).toBe('NEVER');
    expect(triggered(report, ['R03', 'R05', 'R08'])).toBe(true);
    const r10 = report.results.find((r) => r.ruleId === 'R10');
    expect(r10?.severity).toBe('warn');
  });

  it('Sample 004 (BMW E90) → NEVER (R08) + R10 warn (외제차 200만 임계)', () => {
    const facts = encarToFacts(sample004);
    const report = evaluate(facts);
    expect(report.verdict).toBe('NEVER');
    expect(triggered(report, ['R08'])).toBe(true);
    const r05 = report.results.find((r) => r.ruleId === 'R05');
    expect(r05?.severity).toBe('pass'); // 법인≠렌트 invariant
    const r10 = report.results.find((r) => r.ruleId === 'R10');
    expect(r10?.severity).toBe('warn');
  });

  it('Synthetic ideal sample → OK (no killer, no warn)', () => {
    const facts = encarToFacts(sampleIdeal);
    const report = evaluate(facts);
    expect(report.verdict).toBe('OK');
    expect(report.killers.length).toBe(0);
    expect(report.warns.length).toBe(0);
  });
});
