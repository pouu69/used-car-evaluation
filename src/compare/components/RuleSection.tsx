// src/compare/components/RuleSection.tsx
import React from 'react';
import type { CompareCarData } from '../App.js';
import type { Severity } from '@/core/types/RuleTypes.js';
import { RULE_META } from '@/sidepanel/rule-meta.js';

const SEVERITY_LABEL: Record<Severity, string> = {
  pass: 'PASS',
  warn: 'WARN',
  fail: 'FAIL',
  killer: 'KILLER',
  unknown: '—',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  pass: '#00C853',
  warn: '#FFD600',
  fail: '#FF1744',
  killer: '#FF1744',
  unknown: '#9E9E9E',
};

interface RuleSectionProps {
  cars: CompareCarData[];
  colCount: number;
  allRuleIds: string[];
}

export const RuleSection: React.FC<RuleSectionProps> = ({ cars, colCount, allRuleIds }) => {
  const hasDiff = (ruleId: string): boolean => {
    const severities = cars.map((c) => {
      const r = c.report.results.find((r) => r.ruleId === ruleId);
      return r?.severity ?? 'unknown';
    });
    return new Set(severities).size > 1;
  };

  return (
    <>
      <tr>
        <td className="ct-section-header" colSpan={colCount}>
          Rules
        </td>
      </tr>
      {allRuleIds.map((ruleId) => {
        const diff = hasDiff(ruleId);
        const meta = RULE_META[ruleId];
        return (
          <tr key={ruleId} className={diff ? 'ct-diff' : ''}>
            <td className="ct-label">
              {ruleId} {meta?.shortTitle ?? ''}
            </td>
            {cars.map((c) => {
              const result = c.report.results.find((r) => r.ruleId === ruleId);
              const sev = result?.severity ?? 'unknown';
              return (
                <td key={c.carId}>
                  <span style={{ color: SEVERITY_COLOR[sev], fontWeight: 700 }}>
                    {SEVERITY_LABEL[sev]}
                  </span>
                  {result && sev !== 'pass' && sev !== 'unknown' && (
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#666',
                        marginTop: 2,
                      }}
                    >
                      {result.message}
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
};
