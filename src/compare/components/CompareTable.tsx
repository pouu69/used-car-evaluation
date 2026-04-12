// src/compare/components/CompareTable.tsx
import React from 'react';
import type { CompareCarData } from '../App.js';
import type { Verdict, Severity } from '@/core/types/RuleTypes.js';
import { RULE_META } from '@/sidepanel/rule-meta.js';

const VERDICT_COLOR: Record<Verdict, string> = {
  OK: '#00C853',
  CAUTION: '#FFD600',
  NEVER: '#FF1744',
  UNKNOWN: '#9E9E9E',
};

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

const fmtMileage = (km: number | null): string =>
  km === null ? '—' : km >= 10000 ? `${(km / 10000).toFixed(1)}만km` : `${km.toLocaleString()}km`;

const fmtPrice = (won: number | null): string =>
  won === null ? '—' : `${won.toLocaleString()}만원`;

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
  // Collect all rule IDs across all cars
  const allRuleIds = Array.from(
    new Set(cars.flatMap((c) => c.report.results.map((r) => r.ruleId))),
  ).sort();

  // Check if severities differ in a rule row
  const hasDiff = (ruleId: string): boolean => {
    const severities = cars.map((c) => {
      const r = c.report.results.find((r) => r.ruleId === ruleId);
      return r?.severity ?? 'unknown';
    });
    return new Set(severities).size > 1;
  };

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
          {/* Section: Summary */}
          <tr>
            <td className="ct-section-header" colSpan={colCount}>
              Summary
            </td>
          </tr>
          <tr>
            <td className="ct-label">Verdict</td>
            {cars.map((c) => (
              <td key={c.carId}>
                <span
                  className="ct-verdict"
                  style={{ color: VERDICT_COLOR[c.report.verdict] }}
                >
                  {c.report.verdict}
                </span>
              </td>
            ))}
          </tr>
          <tr>
            <td className="ct-label">Score</td>
            {cars.map((c) => (
              <td key={c.carId}>
                <strong>{c.report.score}</strong>
                <div style={{ marginTop: 4 }}>
                  <span className="ct-score-bar">
                    <span
                      className="ct-score-fill"
                      style={{ width: `${Math.min(c.report.score, 100)}%` }}
                    />
                  </span>
                </div>
              </td>
            ))}
          </tr>

          {/* Section: Specs */}
          <tr>
            <td className="ct-section-header" colSpan={colCount}>
              Specs
            </td>
          </tr>
          <tr>
            <td className="ct-label">Price</td>
            {cars.map((c) => (
              <td key={c.carId} style={{ fontWeight: 600 }}>
                {fmtPrice(c.priceWon)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="ct-label">Year</td>
            {cars.map((c) => (
              <td key={c.carId}>{c.year ?? '—'}</td>
            ))}
          </tr>
          <tr>
            <td className="ct-label">Mileage</td>
            {cars.map((c) => (
              <td key={c.carId}>{fmtMileage(c.mileageKm)}</td>
            ))}
          </tr>
          <tr>
            <td className="ct-label">Fuel</td>
            {cars.map((c) => (
              <td key={c.carId}>{c.fuelType ?? '—'}</td>
            ))}
          </tr>

          {/* Section: Rules */}
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
                  const result = c.report.results.find(
                    (r) => r.ruleId === ruleId,
                  );
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
        </tbody>
      </table>
    </div>
  );
};
