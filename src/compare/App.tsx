import React, { useEffect, useState } from 'react';
import type { Message } from '@/core/messaging/protocol.js';
import type { EnrichedSavedRow, SpecSnapshot } from '@/core/storage/saved.js';
import type { ChecklistFacts } from '@/core/types/ChecklistFacts.js';
import type { RuleReport } from '@/core/types/RuleTypes.js';
import { globalCss } from '@/sidepanel/theme.js';
import { CompareTable } from './components/CompareTable.js';

export interface CompareCarData extends SpecSnapshot {
  carId: string;
  url: string;
  facts: ChecklistFacts;
  report: RuleReport;
}

export const CompareApp: React.FC = () => {
  const [cars, setCars] = useState<CompareCarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = params.get('ids')?.split(',').filter(Boolean) ?? [];
    if (ids.length < 2) {
      setError('비교할 차량을 2대 이상 선택해 주세요.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const results = await Promise.all(
          ids.map((id) =>
            chrome.runtime.sendMessage<Message>({ type: 'GET_SAVED_ONE', carId: id }),
          ),
        );
        const matched = results.filter((r): r is EnrichedSavedRow => !!r);
        if (matched.length < 2) {
          setError('저장된 차량을 찾을 수 없습니다. 목록을 확인해 주세요.');
          setLoading(false);
          return;
        }
        setCars(
          matched.map((r) => ({
            carId: r.carId,
            url: r.url,
            title: r.title,
            year: r.year,
            mileageKm: r.mileageKm,
            priceWon: r.priceWon,
            fuelType: r.fuelType,
            facts: r.facts,
            report: r.report,
          })),
        );
      } catch {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#000' }}>
      <style>{globalCss}</style>
      <header
        style={{
          padding: '24px 32px',
          borderBottom: '4px solid #000',
          fontFamily: "'Archivo Black', sans-serif",
          fontSize: '24px',
          textTransform: 'uppercase',
          letterSpacing: '-0.5px',
        }}
      >
        AutoVerdict Compare
      </header>
      {loading && (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            fontFamily: "'Space Mono', monospace",
            fontSize: '12px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}
        >
          LOADING...
        </div>
      )}
      {error && (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: '14px',
            color: '#666',
          }}
        >
          {error}
        </div>
      )}
      {!loading && !error && cars.length >= 2 && (
        <CompareTable cars={cars} />
      )}
    </div>
  );
};
