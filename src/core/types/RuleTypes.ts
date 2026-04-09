/**
 * Layer D — Rule types.
 */
import type { ChecklistFacts } from './ChecklistFacts.js';

export type Severity = 'pass' | 'warn' | 'fail' | 'killer' | 'unknown';

export interface RuleResult {
  ruleId: string;
  title: string;
  severity: Severity;
  message: string;
  evidence: Array<{ field: string; value: unknown }>;
  acknowledgeable: boolean;
}

export type Rule = (facts: ChecklistFacts) => RuleResult | null;

export type Verdict = 'NEVER' | 'CAUTION' | 'OK' | 'UNKNOWN';

export interface RuleReport {
  verdict: Verdict;
  score: number; // 0..100
  results: RuleResult[];
  killers: RuleResult[];
  warns: RuleResult[];
}
