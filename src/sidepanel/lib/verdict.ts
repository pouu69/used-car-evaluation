import type { Verdict, RuleResult } from '@/core/types/RuleTypes.js';
import { RULE_META } from '../rule-meta.js';

export function mapVerdictLabel(v: Verdict): string {
  switch (v) {
    case 'NEVER':   return 'DO NOT\nBUY.';
    case 'CAUTION': return 'CAUTION.\nREAD ME.';
    case 'OK':      return 'GOOD.';
    case 'UNKNOWN': return 'CHECK\nTHIS.';
  }
}

export function buildVerdictSummary(killers: RuleResult[], warns: RuleResult[]): string {
  const combined = [...killers, ...warns].slice(0, 3);
  if (combined.length === 0) return '특이사항 없음';
  return combined
    .map(r => RULE_META[r.ruleId]?.shortTitle ?? r.title)
    .join(' · ');
}
