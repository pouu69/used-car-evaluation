import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message } from '@/core/messaging/protocol.js';
import {
  isCollectProgress,
  isCollectResult,
  isCollectError,
} from '@/core/messaging/protocol.js';
import { extractCarId } from '@/core/encar/url.js';
import type { CacheRow } from '@/core/storage/db.js';

// Re-export shared URL helpers so existing consumers importing from this hook
// (e.g. `App.tsx` pulls `isEncarDetail`) keep working without changes.
export { extractCarId, isEncarDetail } from '@/core/encar/url.js';

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

type RefreshWatchdog = {
  timeout: ReturnType<typeof setTimeout>;
  listener: (msg: unknown) => void;
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

  // Tracks any in-flight refresh() watchdog (timeout + temporary listener) so
  // we can tear it down on unmount or when a subsequent refresh() starts.
  const refreshWatchdogRef = useRef<RefreshWatchdog | null>(null);

  const clearRefreshWatchdog = useCallback(() => {
    const current = refreshWatchdogRef.current;
    if (!current) return;
    clearTimeout(current.timeout);
    chrome.runtime.onMessage.removeListener(current.listener);
    refreshWatchdogRef.current = null;
  }, []);

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
      if (isCollectProgress(msg)) {
        setProgressStage(msg.stage);
        setLoadError(null);
      } else if (isCollectResult(msg)) {
        setProgressStage(null);
        setLoadError(null);
        const cur = activeRef.current;
        if (cur && cur.carId === msg.carId) {
          const now = Date.now();
          setRow({
            carId: msg.carId,
            url: cur.url,
            parsed: msg.parsed,
            facts: msg.facts,
            report: msg.report,
            cachedAt: now,
            expiresAt: now + 24 * 60 * 60 * 1000,
          });
          setLoading(false);
        } else {
          // Not for current tab — reconcile via DB.
          void load();
        }
      } else if (isCollectError(msg)) {
        setProgressStage(null);
        const cur = activeRef.current;
        if (cur && cur.carId === msg.carId) {
          setLoadError(msg.reason);
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
      clearRefreshWatchdog();
    };
  }, [load, clearRefreshWatchdog]);

  const refresh = useCallback(async () => {
    // Tear down any prior in-flight refresh watchdog before starting a new one.
    clearRefreshWatchdog();

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
    const timeout = setTimeout(() => {
      setLoadError('watchdog_timeout');
      setProgressStage(null);
      // Self-clean on fire so the ref doesn't dangle past the timer.
      const current = refreshWatchdogRef.current;
      if (current && current.timeout === timeout) {
        chrome.runtime.onMessage.removeListener(current.listener);
        refreshWatchdogRef.current = null;
      }
    }, 22_000);

    const off = (msg: unknown) => {
      if (
        isCollectResult(msg) ||
        isCollectError(msg) ||
        isCollectProgress(msg)
      ) {
        const current = refreshWatchdogRef.current;
        if (current && current.timeout === timeout) {
          clearTimeout(current.timeout);
          chrome.runtime.onMessage.removeListener(current.listener);
          refreshWatchdogRef.current = null;
        }
      }
    };
    chrome.runtime.onMessage.addListener(off);
    refreshWatchdogRef.current = { timeout, listener: off };
  }, [clearRefreshWatchdog]);

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
