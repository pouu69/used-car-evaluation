// src/compare/components/CompareTable.tsx
import React from 'react';
import type { CompareCarData } from '../App.js';
import { SummarySection } from './SummarySection.js';
import { SpecSection } from './SpecSection.js';
import { RuleSection } from './RuleSection.js';

const css = `
.ct-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Inter Tight', sans-serif;
  font-size: 13px;
}
.ct-table th,
.ct-table td {
  border: 2px solid #000;
  padding: 10px 14px;
  text-align: center;
  vertical-align: middle;
}
.ct-table th {
  font-family: 'Archivo Black', sans-serif;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #000;
  color: #fff;
}
.ct-label {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  text-align: left;
  background: #f5f5f5;
  font-weight: 700;
  white-space: nowrap;
}
.ct-section-header {
  font-family: 'Archivo Black', sans-serif;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  background: #000;
  color: #CCFF00;
  text-align: left;
}
.ct-diff {
  background: #FFFDE7;
}
.ct-verdict {
  font-family: 'Archivo Black', sans-serif;
  font-size: 16px;
}
.ct-score-bar {
  display: inline-block;
  width: 80px;
  height: 8px;
  background: #e0e0e0;
  position: relative;
  vertical-align: middle;
}
.ct-score-fill {
  height: 100%;
  background: #000;
}
.ct-link {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.5px;
  color: #000;
}
`;

interface CompareTableProps {
  cars: CompareCarData[];
}

export const CompareTable: React.FC<CompareTableProps> = ({ cars }) => {
  const allRuleIds = Array.from(
    new Set(cars.flatMap((c) => c.report.results.map((r) => r.ruleId))),
  ).sort();

  const colCount = cars.length + 1;

  return (
    <div style={{ padding: '0 24px 48px', overflowX: 'auto' }}>
      <style>{css}</style>
      <table className="ct-table">
        <thead>
          <tr>
            <th style={{ width: '140px' }}></th>
            {cars.map((c) => (
              <th key={c.carId}>
                <div>{c.title || c.carId}</div>
                <a
                  className="ct-link"
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#CCFF00' }}
                >
                  엔카에서 보기 →
                </a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SummarySection cars={cars} colCount={colCount} />
          <SpecSection cars={cars} colCount={colCount} />
          <RuleSection cars={cars} colCount={colCount} allRuleIds={allRuleIds} />
        </tbody>
      </table>
    </div>
  );
};
