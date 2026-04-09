import type { RuleResult } from '@/core/types/RuleTypes.js';
import { CATEGORY_ORDER, type Category, RULE_META } from '../rule-meta.js';

export interface RadarAxis {
  category: Category;
  pass: number;
  total: number;
  pct: number;
}

export function computeRadarAxes(results: RuleResult[]): RadarAxis[] {
  return CATEGORY_ORDER.map(category => {
    const matching = results.filter(r => {
      const cat = RULE_META[r.ruleId]?.category ?? '투명성';
      return cat === category;
    });
    const total = matching.length;
    const pass = matching.filter(r => r.severity === 'pass').length;
    const pct = total > 0 ? Math.round(pass / total * 100) : 0;
    return { category, pass, total, pct };
  });
}
