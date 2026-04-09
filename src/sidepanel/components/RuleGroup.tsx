import React from 'react';
import type { RuleResult } from '@/core/types/RuleTypes.js';
import type { Category } from '../rule-meta.js';
import { getHealthLevel, passRatio } from '../lib/percent.js';
import { RuleCard } from './RuleCard.js';

interface RuleGroupProps {
  category: Category;
  rules: RuleResult[];
  startIndex: number;
  onAck: (ruleId: string) => void;
}

const CATEGORY_EN: Record<Category, string> = {
  '차량 상태': 'Condition',
  '이력': 'History',
  '사고': 'Accident',
  '가격': 'Price',
  '투명성': 'Disclosure',
};

export const css: string = `
.rg-root {
  border-bottom: 3px solid #000;
}

.rg-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 9px 14px 7px;
  background: #000;
  color: #fff;
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  font-weight: 700;
}

.rg-count {
  font-family: 'Archivo Black', sans-serif;
  font-size: 12px;
  letter-spacing: 0;
  text-transform: none;
}

.rg-count--danger { color: #ff2d4b; }
.rg-count--good   { color: #e4ff00; }
.rg-count--normal { color: #fff; }
`;

export const RuleGroup: React.FC<RuleGroupProps> = ({
  category,
  rules,
  startIndex,
  onAck,
}) => {
  const total = rules.length;
  const passCount = rules.filter((r) => r.severity === 'pass').length;
  const ratio = passRatio(passCount, total);
  const health = getHealthLevel(ratio);

  const countClass =
    health === 'bad'
      ? 'rg-count rg-count--danger'
      : health === 'good'
        ? 'rg-count rg-count--good'
        : 'rg-count rg-count--normal';

  return (
    <div className="rg-root">
      <div className="rg-header">
        <span>◼ {category} / {CATEGORY_EN[category]}</span>
        <span className={countClass}>
          {passCount} / {total}
        </span>
      </div>
      <div>
        {rules.map((rule, i) => (
          <RuleCard
            key={rule.ruleId}
            result={rule}
            index={startIndex + i}
            onAck={onAck}
          />
        ))}
      </div>
    </div>
  );
};
