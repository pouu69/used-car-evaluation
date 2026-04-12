import { useCallback, useEffect, useState } from 'react';
import type { Message } from '@/core/messaging/protocol.js';
import type { CacheRow } from '@/core/storage/db.js';
import type { SavedRow } from '@/core/storage/saved.js';
import type { ChecklistFacts } from '@/core/types/ChecklistFacts.js';
import type { RuleReport } from '@/core/types/RuleTypes.js';

interface UseSavedCarsResult {
  savedState: boolean;
  savedListKey: number;
  viewingSavedCarId: string | null;
  savedRow: CacheRow | null;
  handleToggleSave: () => Promise<void>;
  handleViewSavedCar: (carId: string) => Promise<void>;
  clearOverride: () => void;
}

export const useSavedCars = (
  liveRow: CacheRow | null,
): UseSavedCarsResult => {
  const [savedState, setSavedState] = useState(false);
  const [savedListKey, setSavedListKey] = useState(0);
  const [viewingSavedCarId, setViewingSavedCarId] = useState<string | null>(null);
  const [savedRow, setSavedRow] = useState<CacheRow | null>(null);

  const displayedCarId = viewingSavedCarId ?? liveRow?.carId ?? null;

  // Check if displayed car is saved whenever it changes.
  useEffect(() => {
    if (!displayedCarId) return;
    chrome.runtime
      .sendMessage<Message>({ type: 'IS_SAVED', carId: displayedCarId })
      .then((resp) => setSavedState((resp as { saved: boolean })?.saved ?? false))
      .catch(() => setSavedState(false));
  }, [displayedCarId]);

  const handleToggleSave = useCallback(async () => {
    const target = viewingSavedCarId ? savedRow : liveRow;
    if (!target) return;
    if (savedState) {
      await chrome.runtime
        .sendMessage<Message>({ type: 'UNSAVE_CAR', carId: target.carId })
        .catch(() => {});
      setSavedState(false);
      setSavedListKey((k) => k + 1);
    } else {
      const res = await chrome.runtime
        .sendMessage<Message>({
          type: 'SAVE_CAR',
          carId: target.carId,
          url: target.url,
          parsed: target.parsed,
        })
        .catch(() => ({ ok: false }));
      if (res?.reason === 'limit') return;
      setSavedState(true);
      setSavedListKey((k) => k + 1);
    }
  }, [viewingSavedCarId, savedRow, liveRow, savedState]);

  const handleViewSavedCar = useCallback(async (carId: string) => {
    // If the clicked car IS the live tab's car, switch to live without override.
    if (liveRow && liveRow.carId === carId) {
      setViewingSavedCarId(null);
      setSavedRow(null);
      return;
    }
    // Different car — load saved snapshot as override.
    const found = (await chrome.runtime.sendMessage<Message>({
      type: 'GET_SAVED_ONE',
      carId,
    })) as (SavedRow & { facts: ChecklistFacts; report: RuleReport }) | null;
    if (!found) return;
    setSavedRow({
      carId: found.carId,
      url: found.url,
      parsed: found.parsed,
      facts: found.facts,
      report: found.report,
      cachedAt: found.updatedAt,
      expiresAt: found.expiresAt,
    });
    setViewingSavedCarId(carId);
  }, [liveRow]);

  const clearOverride = useCallback(() => {
    setViewingSavedCarId(null);
    setSavedRow(null);
  }, []);

  return {
    savedState,
    savedListKey,
    viewingSavedCarId,
    savedRow,
    handleToggleSave,
    handleViewSavedCar,
    clearOverride,
  };
};
