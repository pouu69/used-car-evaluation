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
  sample007,
  samplePersonalClean,
  sampleIdeal,
} from '../src/__fixtures__/samples.js';

const triggered = (report: ReturnType<typeof evaluate>, ids: string[]) => {
  const set = new Set(report.killers.map((r) => r.ruleId));
  return ids.every((id) => set.has(id));
};

describe('integration: parsed → facts → verdict', () => {
  it('Sample 001 (스포티지) → NEVER via R05 (rental); R08 demoted to warn', () => {
    const facts = encarToFacts(sample001);
    const report = evaluate(facts);
    expect(report.verdict).toBe('NEVER');
    expect(triggered(report, ['R05'])).toBe(true);
    // R08 자차보험 공백은 이제 warn (killer 아님).
    const r08 = report.results.find((r) => r.ruleId === 'R08');
    expect(r08?.severity).toBe('warn');
  });

  it('Sample 002 (팰리세이드) → NEVER via R05 (rental); R03 dropped', () => {
    const facts = encarToFacts(sample002);
    const report = evaluate(facts);
    expect(report.verdict).toBe('NEVER');
    expect(triggered(report, ['R05'])).toBe(true);
    const r08 = report.results.find((r) => r.ruleId === 'R08');
    expect(r08?.severity).toBe('warn');
    // 엔카진단을 받지 않았지만 R03은 감점(killer) 대신 결과에서 완전히 드랍.
    expect(report.results.find((r) => r.ruleId === 'R03')).toBeUndefined();
  });

  it('Sample 003 (팰리세이드 2.2) → NEVER via R05; R08 warn + R10 warn', () => {
    const facts = encarToFacts(sample003);
    const report = evaluate(facts);
    expect(report.verdict).toBe('NEVER');
    expect(triggered(report, ['R05'])).toBe(true);
    expect(report.results.find((r) => r.ruleId === 'R03')).toBeUndefined();
    const r08 = report.results.find((r) => r.ruleId === 'R08');
    expect(r08?.severity).toBe('warn');
    // R10: 타차피해 2.57M 원 ≥ 국산 신 임계 2M → 여전히 warn.
    const r10 = report.results.find((r) => r.ruleId === 'R10');
    expect(r10?.severity).toBe('warn');
  });

  it('Sample 004 (BMW E90) → CAUTION (killer 없음, R08/R10 warn)', () => {
    const facts = encarToFacts(sample004);
    const report = evaluate(facts);
    // R08이 warn 으로 내려가면서 이 매물은 killer 가 사라짐 → CAUTION 등급.
    expect(report.verdict).toBe('CAUTION');
    expect(report.killers.length).toBe(0);
    const r05 = report.results.find((r) => r.ruleId === 'R05');
    expect(r05?.severity).toBe('pass'); // 법인≠렌트 invariant
    const r08 = report.results.find((r) => r.ruleId === 'R08');
    expect(r08?.severity).toBe('warn');
    // 수입차 신 임계 3M 원, my=8.97M → 여전히 warn.
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

  it('Sample 006 (BMW G30 개인매물) → CAUTION (R08 warn, R03 unknown)', () => {
    const facts = encarToFacts(sample006);
    const report = evaluate(facts);
    // R08 완화 이후 killer 가 없어지고, warn 다수만 남음 → CAUTION.
    expect(report.verdict).toBe('CAUTION');
    expect(report.killers.length).toBe(0);
    const r08 = report.results.find((r) => r.ruleId === 'R08');
    expect(r08?.severity).toBe('warn');
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

  it('Sample 007 (BMW F30 렌트) → NEVER (R05, R08) + R04 PASS via inspection', () => {
    // Dealer listing with NO Encar diagnosis but WITH a 성능점검 report
    // that explicitly declares `master.accdient=false`. Before the inspection
    // layer, R04 resolved to UNKNOWN on this fixture. This test locks in the
    // new precedence: diagnosisApi → inspectionApi → ribbon fallback.
    const facts = encarToFacts(sample007);
    const report = evaluate(facts);
    expect(report.verdict).toBe('NEVER');
    expect(triggered(report, ['R05'])).toBe(true);
    // R08 은 더 이상 killer 가 아님 — warn 으로 존재.
    const r08 = report.results.find((r) => r.ruleId === 'R08');
    expect(r08?.severity).toBe('warn');
    // R04 must PASS — frame signal comes from inspection, not diagnosis.
    const r04 = report.results.find((r) => r.ruleId === 'R04');
    expect(r04?.severity).toBe('pass');
    // The inspection-sourced bridge warning must fire (simpleRepair branch).
    expect(facts.bridgeWarnings).toContain(
      'frameDamage_from_inspection_simpleRepair',
    );
    // The ribbon fallback must NOT have been used (isDiagnosisExist=false).
    expect(facts.bridgeWarnings).not.toContain('frameDamage_from_ribbon');
    // R03 is "bonus-only" — when diagnosis is absent the rule is dropped,
    // so it should not appear in the report at all.
    const r03 = report.results.find((r) => r.ruleId === 'R03');
    expect(r03).toBeUndefined();
  });
});
