// src/sidepanel/components/SavedList.tsx
import React, { useCallback, useEffect, useState } from 'react';
import type { Message } from '@/core/messaging/protocol.js';
import type { SavedRow } from '@/core/storage/saved.js';
import type { ChecklistFacts } from '@/core/types/ChecklistFacts.js';
import type { RuleReport } from '@/core/types/RuleTypes.js';
import { SavedCard, css as savedCardCss } from './SavedCard.js';
import type { SavedCardData } from './SavedCard.js';

interface EnrichedSavedRow extends SavedRow {
  facts: ChecklistFacts;
  report: RuleReport;
}

interface SavedListProps {
  onViewCar: (carId: string) => void;
  refreshKey: number;
}

const MAX_COMPARE = 4;

export const css: string = `
${savedCardCss}
.sl-root {
  padding: 0;
}
.sl-empty {
  padding: 32px 16px;
  text-align: center;
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #666;
}
.sl-compare-float {
  position: sticky;
  bottom: 0;
  padding: 12px;
  background: #000;
  text-align: center;
}
.sl-compare-btn {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  text-transform: uppercase;
  color: #000;
  background: #CCFF00;
  border: none;
  padding: 12px 32px;
  cursor: pointer;
  letter-spacing: 0.5px;
}
.sl-compare-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
`;

export const SavedList: React.FC<SavedListProps> = ({ onViewCar, refreshKey }) => {
  const [rows, setRows] = useState<EnrichedSavedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadList = useCallback(async () => {
    try {
      const resp = (await chrome.runtime.sendMessage<Message>({
        type: 'GET_SAVED_LIST',
      })) as EnrichedSavedRow[];
      setRows(resp ?? []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList, refreshKey]);

  const handleDelete = useCallback(
    async (carId: string) => {
      await chrome.runtime
        .sendMessage<Message>({ type: 'UNSAVE_CAR', carId })
        .catch(() => {});
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(carId);
        return next;
      });
      void loadList();
    },
    [loadList],
  );

  const handleSelect = useCallback((carId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(carId)) {
        next.delete(carId);
      } else if (next.size < MAX_COMPARE) {
        next.add(carId);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selected.size < 2) return;
    const ids = Array.from(selected).join(',');
    const url = chrome.runtime.getURL(`src/compare/compare.html?ids=${ids}`);
    chrome.tabs.create({ url });
  }, [selected]);

  if (loading) {
    return (
      <div className="sl-empty">LOADING...</div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="sl-empty">
        저장된 매물이 없습니다.<br />
        차량 페이지에서 SAVE 버튼을 눌러 추가하세요.
      </div>
    );
  }

  const cards: SavedCardData[] = rows.map((r) => ({
    carId: r.carId,
    url: r.url,
    title: r.title,
    year: r.year,
    mileageKm: r.mileageKm,
    priceWon: r.priceWon,
    fuelType: r.fuelType,
    score: r.report.score,
    verdict: r.report.verdict,
    killerCount: r.report.killers.length,
    warnCount: r.report.warns.length,
  }));

  return (
    <div className="sl-root">
      {cards.map((c) => (
        <SavedCard
          key={c.carId}
          data={c}
          selected={selected.has(c.carId)}
          onSelect={handleSelect}
          onView={onViewCar}
          onDelete={handleDelete}
        />
      ))}
      {selected.size >= 2 && (
        <div className="sl-compare-float">
          <button className="sl-compare-btn" onClick={handleCompare}>
            COMPARE {selected.size}
          </button>
        </div>
      )}
    </div>
  );
};
