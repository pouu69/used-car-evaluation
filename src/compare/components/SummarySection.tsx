// src/compare/components/SummarySection.tsx
import React from 'react';
import type { CompareCarData } from '../App.js';
import { VERDICT_COLOR } from '@/sidepanel/theme.js';

interface SummarySectionProps {
  cars: CompareCarData[];
  colCount: number;
}

export const SummarySection: React.FC<SummarySectionProps> = ({ cars, colCount }) => (
  <>
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
  </>
);
