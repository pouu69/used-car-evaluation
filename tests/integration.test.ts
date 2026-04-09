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
  sample006,
  samplePersonalClean,
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

  it('Sample 006 (BMW G30 개인매물) → NEVER (R08) but R03 is NOT a killer', () => {
    const facts = encarToFacts(sample006);
    const report = evaluate(facts);
    expect(report.verdict).toBe('NEVER');
    // R08 KILLER — real problem on this listing
    expect(triggered(report, ['R08'])).toBe(true);
    // R03 must resolve as UNKNOWN (personal listing cannot get diagnosis)
    // — proves the dealer/personal branch in the bridge.
    const r03 = report.results.find((r) => r.ruleId === 'R03');
    expect(r03?.severity).toBe('unknown');
    expect(r03?.message).toContain('개인매물');
    // R04 similarly falls back to unknown (no diagnosis + no inspection).
    const r04 = report.results.find((r) => r.ruleId === 'R04');
    expect(r04?.severity).toBe('unknown');
    // R05 is PASS — this listing is NOT a rental despite being personal.
    const r05 = report.results.find((r) => r.ruleId === 'R05');
    expect(r05?.severity).toBe('pass');
    // R10 WARN — cumulative damages (17.4M원) exceed the 1M domestic threshold
    // (this is an imported car so threshold is 2M, still exceeded).
    const r10 = report.results.find((r) => r.ruleId === 'R10');
    expect(r10?.severity).toBe('warn');
    // Bridge warning must surface the personal branch.
    expect(facts.bridgeWarnings).toContain('personal_listing');
    expect(facts.bridgeWarnings).toContain('r03_skipped_personal');
  });

  it('Synthetic clean personal listing → UNKNOWN (not NEVER, not OK)', () => {
    // The clean-personal fixture has no accidents, no rentals, no insurance
    // gap — but also no diagnosis. Expected behaviour:
    //   - R01/R02/R05/R06/R07/R08/R09/R10/R11 → PASS
    //   - R03 → UNKNOWN (personal can't be diagnosed)
    //   - R04 → UNKNOWN (no frame signal)
    //   - verdict → UNKNOWN (at least one rule is unknown)
    // This locks in that a clean personal listing never verdicts OK, but
    // also never verdicts NEVER just because it's personal.
    const facts = encarToFacts(samplePersonalClean);
    const report = evaluate(facts);
    expect(report.verdict).toBe('UNKNOWN');
    expect(report.killers.length).toBe(0);
    expect(report.warns.length).toBe(0);
    const r03 = report.results.find((r) => r.ruleId === 'R03');
    expect(r03?.severity).toBe('unknown');
    const r04 = report.results.find((r) => r.ruleId === 'R04');
    expect(r04?.severity).toBe('unknown');
    const r01 = report.results.find((r) => r.ruleId === 'R01');
    expect(r01?.severity).toBe('pass');
  });
});
