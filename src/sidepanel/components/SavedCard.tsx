// src/sidepanel/components/SavedCard.tsx
import React from 'react';
import type { Verdict } from '@/core/types/RuleTypes.js';
import { VERDICT_COLOR } from '@/sidepanel/theme.js';
import { fmtMileage, fmtPrice } from '@/sidepanel/lib/format.js';

export interface SavedCardData {
  carId: string;
  url: string;
  title: string;
  year: number | null;
  mileageKm: number | null;
  priceWon: number | null;
  fuelType: string | null;
  score: number;
  verdict: Verdict;
  killerCount: number;
  warnCount: number;
}

interface SavedCardProps {
  data: SavedCardData;
  selected: boolean;
  onSelect: (carId: string) => void;
  onView: (carId: string) => void;
  onDelete: (carId: string) => void;
}


export const css: string = `
.sc-root {
  border: 3px solid #000;
  border-bottom: none;
  padding: 12px 14px;
  cursor: pointer;
  position: relative;
  transition: background 0.1s;
}
.sc-root:last-child {
  border-bottom: 3px solid #000;
}
.sc-root:hover {
  background: #f5f5f5;
}
.sc-root[data-selected='true'] {
  background: #CCFF00;
}
.sc-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}
.sc-verdict {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
}
.sc-specs {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.sc-title {
  font-family: 'Inter Tight', sans-serif;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sc-price {
  font-family: 'Archivo Black', sans-serif;
  font-size: 15px;
  margin-bottom: 6px;
}
.sc-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.5px;
}
.sc-bar {
  flex: 1;
  height: 6px;
  background: #e0e0e0;
  position: relative;
}
.sc-bar-fill {
  height: 100%;
  background: #000;
}
.sc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.sc-action-btn {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 4px 8px;
  border: 2px solid #000;
  background: #fff;
  color: #000;
  cursor: pointer;
  text-decoration: none;
}
.sc-action-btn:hover {
  background: #000;
  color: #fff;
}
.sc-checkbox {
  position: absolute;
  top: 12px;
  left: 14px;
  width: 16px;
  height: 16px;
  accent-color: #000;
}
`;

export const SavedCard: React.FC<SavedCardProps> = ({
  data,
  selected,
  onSelect,
  onView,
  onDelete,
}) => {
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
    onView(data.carId);
  };

  return (
    <div
      className="sc-root"
      data-selected={selected}
      onClick={handleCardClick}
    >
      <input
        type="checkbox"
        className="sc-checkbox"
        checked={selected}
        onChange={() => onSelect(data.carId)}
      />
      <div className="sc-top" style={{ paddingLeft: 24 }}>
        <span
          className="sc-verdict"
          style={{ color: VERDICT_COLOR[data.verdict] }}
        >
          [{data.score}] {data.verdict}
        </span>
        <span className="sc-specs">
          {data.year ?? '—'} · {fmtMileage(data.mileageKm)}
        </span>
      </div>
      <div className="sc-title" style={{ paddingLeft: 24 }}>
        {data.title || '—'}{data.fuelType ? ` ${data.fuelType}` : ''}
      </div>
      <div className="sc-price" style={{ paddingLeft: 24 }}>
        {fmtPrice(data.priceWon)}
      </div>
      <div className="sc-bar-row" style={{ paddingLeft: 24 }}>
        <div className="sc-bar">
          <div
            className="sc-bar-fill"
            style={{ width: `${Math.min(data.score, 100)}%` }}
          />
        </div>
        <span>K:{data.killerCount} W:{data.warnCount}</span>
      </div>
      <div className="sc-actions">
        <a
          className="sc-action-btn"
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          엔카 →
        </a>
        <button
          className="sc-action-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(data.carId); }}
        >
          삭제
        </button>
      </div>
    </div>
  );
};
