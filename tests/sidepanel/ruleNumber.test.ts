import { describe, it, expect } from 'vitest';
import { ruleNumber } from '../../src/sidepanel/lib/ruleNumber.js';

describe('ruleNumber', () => {
  it('R01 → 01', () => expect(ruleNumber('R01')).toBe('01'));
  it('R11 → 11', () => expect(ruleNumber('R11')).toBe('11'));
  it('X99 → 99', () => expect(ruleNumber('X99')).toBe('99'));
  it('R5 → 05 (single digit padded)', () => expect(ruleNumber('R5')).toBe('05'));
  it('R123 → 123 (more than 2 digits, no truncation)', () => expect(ruleNumber('R123')).toBe('123'));
  it('weird → ??', () => expect(ruleNumber('weird')).toBe('??'));
  it('empty string → ??', () => expect(ruleNumber('')).toBe('??'));
  it('R0 → 00', () => expect(ruleNumber('R0')).toBe('00'));
});
