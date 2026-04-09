import React from 'react';
import type { RuleResult, Severity } from '@/core/types/RuleTypes.js';
import { RULE_META } from '../rule-meta.js';
import { ruleNumber } from '../lib/ruleNumber.js';

interface RuleCardProps {
  result: RuleResult;
  index: number;
  onAck?: (ruleId: string) => void;
}

export const css: string = `
@keyframes daksin-stagger-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.rc-stagger {
  animation: daksin-stagger-in 300ms ease-out both;
}

.rc-root {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid #000;
  align-items: start;
}

.rc-root--killer,
.rc-root--fail {
  background: #ff2d4b;
  color: #fff;
}

.rc-root--warn {
  background: #e4ff00;
  color: #000;
}

.rc-root--pass {
  background: #fff;
  color: #000;
}

.rc-root--unknown {
  background: #fafafa;
  color: #000;
}

.rc-number {
  font-family: 'Archivo Black', sans-serif;
  font-size: 16px;
  line-height: 1.1;
}

.rc-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  letter-spacing: -0.2px;
  line-height: 1.1;
  text-transform: uppercase;
}

.rc-message {
  font-family: 'Inter Tight', sans-serif;
  font-size: 11px;
  line-height: 1.5;
  font-weight: 400;
  margin-top: 4px;
}

.rc-tags {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.rc-tag {
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  padding: 2px 5px;
  border: 1px solid currentColor;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rc-ack {
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  background: transparent;
  color: #fff;
  border: 1px solid #fff;
  padding: 4px 10px;
  cursor: pointer;
  margin-top: 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.rc-mark {
  font-family: 'Archivo Black', sans-serif;
  font-size: 22px;
  line-height: 1;
  padding-top: 2px;
}
`;

const SEVERITY_TAGS: Partial<Record<Severity, string[]>> = {
  killer: ['KILLER', 'DO NOT BUY'],
  warn: ['WARN'],
  unknown: ['N/A'],
};

const SEVERITY_MARK: Record<Severity, string> = {
  killer: '✕',
  fail: '✕',
  warn: '▲',
  pass: '✓',
  unknown: '?',
};

export const RuleCard: React.FC<RuleCardProps> = ({ result, index, onAck }) => {
  const tags = SEVERITY_TAGS[result.severity] ?? [];
  const mark = SEVERITY_MARK[result.severity];
  const title = RULE_META[result.ruleId]?.shortTitle ?? result.title;
  const num = ruleNumber(result.ruleId);

  return (
    <div
      className={`rc-root rc-root--${result.severity} rc-stagger`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="rc-number">{num}</div>

      <div>
        <div className="rc-title">{title}</div>
        <div className="rc-message">{result.message}</div>
        {tags.length > 0 && (
          <div className="rc-tags">
            {tags.map((tag) => (
              <span key={tag} className="rc-tag">{tag}</span>
            ))}
          </div>
        )}
        {onAck && result.acknowledgeable && result.severity === 'killer' && (
          <button className="rc-ack" onClick={() => onAck(result.ruleId)}>
            IGNORE 7D
          </button>
        )}
      </div>

      <div className="rc-mark">{mark}</div>
    </div>
  );
};
