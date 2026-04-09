import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message } from '@/core/messaging/protocol.js';
import type { CacheRow } from '@/core/storage/db.js';

export interface ActiveTabInfo {
  tabId: number;
  url: string;
  carId: string | null;
}

export interface UseCarDataResult {
  active: ActiveTabInfo | null;
  row: CacheRow | null;
  loading: boolean;
  progressStage: string | null;
  loadError: string | null;
  refresh: () => Promise<void>;
  ack: (ruleId: string) => void;
}

export const extractCarId = (url: string | undefined): string | null => {
  if (!url) return null;
  const m = /\/cars\/detail\/(\d+)/.exec(url);
  return m?.[1] ?? null;
};

export const isEncarDetail = (url: string | undefined): boolean =>
  !!url && /^https:\/\/fem\.encar\.com\/cars\/detail\//.test(url);

const queryActiveTab = async (): Promise<ActiveTabInfo | null> => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id || !tab.url) return null;
  return { tabId: tab.id, url: tab.url, carId: extractCarId(tab.url) };
};

const triggerCollect = async (
  tabId: number,
  carId: string,
  url: string,
): Promise<void> => {
  try {
    await chrome.runtime.sendMessage<Message>({
      type: 'COLLECT_FOR_TAB',
      carId,
      url,
      tabId,
    });
  } catch {
    /* background may be warming up */
  }
};

export function useCarData(): UseCarDataResult {
  const [active, setActive] = useState<ActiveTabInfo | null>(null);
  const [row, setRow] = useState<CacheRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Ref mirrors `active` so the message listener can read the latest active tab
  // without being recreated on every state change.
  const activeRef = useRef<ActiveTabInfo | null>(null);
  activeRef.current = active;

  const load = useCallback(async () => {
    const tabInfo = await queryActiveTab();
    setActive(tabInfo);
    if (!tabInfo?.carId) {
      setRow(null);
      setLoading(false);
      return;
    }
    try {
      const resp = (await chrome.runtime.sendMessage<Message>({
        type: 'GET_LAST',
        carId: tabInfo.carId,
      })) as CacheRow | null;
      setRow(resp ?? null);
      if (resp) {
        setProgressStage(null);
        setLoadError(null);
        setLoading(false);
        return;
      }
      // Cache miss — proactively trigger a background collect.
      setProgressStage('start');
      void triggerCollect(tabInfo.tabId, tabInfo.carId, tabInfo.url);
    } catch {
      setRow(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();

    const listener = (msg: unknown) => {
      if (typeof msg !== 'object' || msg === null || !('type' in msg)) return;
      const m = msg as Message;
      if (m.type === 'COLLECT_PROGRESS') {
        setProgressStage(m.stage);
        setLoadError(null);
      } else if (m.type === 'COLLECT_RESULT') {
        setProgressStage(null);
        setLoadError(null);
        const cur = activeRef.current;
        if (cur && cur.carId === m.carId) {
          const now = Date.now();
          setRow({
            carId: m.carId,
            url: cur.url,
            parsed: m.parsed,
            facts: m.facts,
            report: m.report,
            cachedAt: now,
            expiresAt: now + 24 * 60 * 60 * 1000,
          });
          setLoading(false);
        } else {
          // Not for current tab — reconcile via DB.
          void load();
        }
      } else if (m.type === 'COLLECT_ERROR') {
        setProgressStage(null);
        const cur = activeRef.current;
        if (cur && cur.carId === m.carId) {
          setLoadError(m.reason);
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    const onActivated = () => {
      setLoading(true);
      setProgressStage(null);
      void load();
    };
    chrome.tabs.onActivated.addListener(onActivated);

    const onUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tabObj: chrome.tabs.Tab,
    ) => {
      if (!tabObj.active) return;
      if (changeInfo.url) {
        setRow(null);
        setProgressStage('start');
        setLoading(true);
        void load();
      } else if (changeInfo.status === 'complete') {
        void load();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [load]);

  const refresh = useCallback(async () => {
    const fresh = await queryActiveTab();
    setActive(fresh);
    if (!fresh?.carId) {
      setLoading(false);
      return;
    }

    // Clear every transient state.
    setLoadError(null);
    setProgressStage('start');
    setRow(null);
    setLoading(true);

    // Invalidate cache, then trigger fresh collect via background.
    await chrome.runtime
      .sendMessage<Message>({ type: 'REFRESH', carId: fresh.carId })
      .catch(() => {});
    void triggerCollect(fresh.tabId, fresh.carId, fresh.url);

    // Safety net: if no result arrives in 22s, surface a watchdog error.
    const hardTimeout = setTimeout(() => {
      setLoadError('watchdog_timeout');
      setProgressStage(null);
    }, 22_000);
    const off = (msg: unknown) => {
      if (
        typeof msg === 'object' &&
        msg !== null &&
        'type' in msg &&
        ((msg as Message).type === 'COLLECT_RESULT' ||
          (msg as Message).type === 'COLLECT_ERROR' ||
          (msg as Message).type === 'COLLECT_PROGRESS')
      ) {
        clearTimeout(hardTimeout);
        chrome.runtime.onMessage.removeListener(off);
      }
    };
    chrome.runtime.onMessage.addListener(off);
  }, []);

  const ack = useCallback(
    (ruleId: string) => {
      if (!confirm('정말 무시하시겠습니까? 7일 동안 이 체크는 비활성화됩니다.'))
        return;
      const cur = activeRef.current;
      if (!cur?.carId) return;
      chrome.runtime
        .sendMessage<Message>({ type: 'ACK_RULE', carId: cur.carId, ruleId })
        .then(() => void load())
        .catch(() => {});
    },
    [load],
  );

  return { active, row, loading, progressStage, loadError, refresh, ack };
}
