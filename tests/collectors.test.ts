/**
 * Unit tests for the collectors/merge layer.
 * These lock in the merge policy so future sources can be added without
 * accidentally changing the resolution rules.
 */
import { describe, it, expect } from 'vitest';
import {
  mergeFieldStatus,
  mergeFieldStatusMap,
  type MergeCandidate,
} from '../src/core/collectors/merge.js';
import { SOURCE_REGISTRY, bySourcePriority } from '../src/core/collectors/sources.js';
import type { FieldStatus } from '../src/core/types/FieldStatus.js';

const v = <T>(value: T): FieldStatus<T> => ({ kind: 'value', value });
const fail = <T>(reason: string): FieldStatus<T> => ({
  kind: 'parse_failed',
  reason,
});
const loading = <T>(): FieldStatus<T> => ({ kind: 'loading' });
const hidden = <T>(): FieldStatus<T> => ({ kind: 'hidden_by_dealer' });

describe('collectors/sources', () => {
  it('has unique priorities for distinct kinds', () => {
    const ids = Object.keys(SOURCE_REGISTRY);
    expect(ids.length).toBeGreaterThan(5);
    // manual must outrank everything
    const manual = SOURCE_REGISTRY.manual.priority;
    for (const id of ids) {
      if (id === 'manual') continue;
      expect(SOURCE_REGISTRY[id as keyof typeof SOURCE_REGISTRY].priority)
        .toBeLessThan(manual);
    }
  });

  it('sorts descending by priority', () => {
    const sorted = (['main_dom', 'record_api', 'preloaded_state'] as const)
      .slice()
      .sort(bySourcePriority);
    expect(sorted[0]).toBe('preloaded_state');
    expect(sorted[sorted.length - 1]).toBe('main_dom');
  });
});

describe('mergeFieldStatus', () => {
  it('returns parse_failed(no_sources) for empty input', () => {
    const r = mergeFieldStatus([]);
    expect(r.status.kind).toBe('parse_failed');
    if (r.status.kind === 'parse_failed') {
      expect(r.status.reason).toBe('no_sources');
    }
    expect(r.warnings).toEqual([]);
  });

  it('picks the single successful value through', () => {
    const r = mergeFieldStatus<number>([
      { source: 'record_api', status: v(3) },
      { source: 'main_dom', status: fail('dom_err') },
    ]);
    expect(r.status).toEqual(v(3));
    expect(r.chosenSource).toBe('record_api');
    expect(r.warnings).toEqual([]);
  });

  it('prefers the highest priority source when all agree', () => {
    const cs: MergeCandidate<boolean>[] = [
      { source: 'main_dom', status: v(true) },
      { source: 'record_api', status: v(true) },
      { source: 'preloaded_state', status: v(true) },
    ];
    const r = mergeFieldStatus(cs);
    expect(r.chosenSource).toBe('preloaded_state');
    expect(r.warnings).toEqual([]);
  });

  it('emits merge_conflict warnings when values disagree', () => {
    const cs: MergeCandidate<boolean>[] = [
      { source: 'inspection_api', status: v(false) },
      { source: 'record_api', status: v(true) },
    ];
    const r = mergeFieldStatus(cs);
    expect(r.status).toEqual(v(false)); // inspection + record tie on 95, insertion order wins
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/merge_conflict/);
  });

  it('manual override always wins', () => {
    const cs: MergeCandidate<number>[] = [
      { source: 'preloaded_state', status: v(1) },
      { source: 'record_api', status: v(2) },
      { source: 'manual', status: v(99) },
    ];
    const r = mergeFieldStatus(cs);
    expect(r.chosenSource).toBe('manual');
    expect(r.status).toEqual(v(99));
    expect(r.warnings.length).toBe(2); // conflicts with both lower-priority sources
  });

  it('deep equality on objects suppresses warning when identical', () => {
    const a = { rental: false, taxi: false };
    const b = { rental: false, taxi: false };
    const r = mergeFieldStatus([
      { source: 'record_api', status: v(a) },
      { source: 'inspection_api', status: v(b) },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it('returns loading if any candidate is loading and none is value', () => {
    const r = mergeFieldStatus<boolean>([
      { source: 'record_api', status: loading() },
      { source: 'main_dom', status: fail('dom_err') },
    ]);
    expect(r.status.kind).toBe('loading');
    expect(r.warnings).toEqual([]);
  });

  it('a successful value beats a loading sibling', () => {
    const r = mergeFieldStatus<boolean>([
      { source: 'record_api', status: loading() },
      { source: 'inspection_api', status: v(true) },
    ]);
    expect(r.status).toEqual(v(true));
    expect(r.chosenSource).toBe('inspection_api');
  });

  it('returns hidden_by_dealer only when every source is hidden', () => {
    const r = mergeFieldStatus<boolean>([
      { source: 'preloaded_state', status: hidden() },
      { source: 'main_dom', status: hidden() },
    ]);
    expect(r.status.kind).toBe('hidden_by_dealer');
  });

  it('summarises every failure reason when all sources fail', () => {
    const r = mergeFieldStatus<number>([
      { source: 'preloaded_state', status: fail('missing') },
      { source: 'record_api', status: { kind: 'timeout' } },
    ]);
    expect(r.status.kind).toBe('parse_failed');
    if (r.status.kind === 'parse_failed') {
      expect(r.status.reason).toContain('preloaded_state:missing');
      expect(r.status.reason).toContain('record_api:timeout');
    }
  });

  it('accepts custom equality function', () => {
    const eq = (a: number, b: number) => Math.abs(a - b) < 10;
    const r = mergeFieldStatus<number>(
      [
        { source: 'record_api', status: v(100) },
        { source: 'inspection_api', status: v(103) },
      ],
      eq,
    );
    expect(r.warnings).toEqual([]);
  });
});

describe('mergeFieldStatusMap', () => {
  it('ignores undefined entries', () => {
    const r = mergeFieldStatusMap<boolean>({
      record_api: v(true),
      main_dom: undefined,
    });
    expect(r.status).toEqual(v(true));
    expect(r.chosenSource).toBe('record_api');
  });

  it('behaves identically to the array form', () => {
    const arrForm = mergeFieldStatus<number>([
      { source: 'preloaded_state', status: v(1) },
      { source: 'record_api', status: v(1) },
    ]);
    const mapForm = mergeFieldStatusMap<number>({
      preloaded_state: v(1),
      record_api: v(1),
    });
    expect(mapForm.status).toEqual(arrForm.status);
    expect(mapForm.chosenSource).toBe(arrForm.chosenSource);
    expect(mapForm.warnings).toEqual(arrForm.warnings);
  });
});
