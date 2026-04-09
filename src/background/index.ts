/**
 * Background service worker.
 * - Receives COLLECT_REQUEST from content scripts.
 * - Fetches S3 (history), S4-S6 (reports) with credentials:include.
 * - Runs orchestrate → bridge → rules → caches → broadcasts COLLECT_RESULT.
 * - Sweeps expired cache/ack rows on alarm.
 */
import { orchestrate } from '@/core/parsers/encar/index';
import { encarToFacts } from '@/core/bridge/encar-to-facts';
import { evaluate } from '@/core/rules/index';
import { CACHE_TTL_MS, getDb, sweepExpired } from '@/core/storage/db';
import { isMessage, type Message } from '@/core/messaging/protocol';
import {
  mainWorldCollect,
  type MainWorldPayload,
  type FetchStatus,
} from './main-world-collector';

const fetchText = async (
  url: string,
  signal: AbortSignal,
  perRequestMs = 8_000,
): Promise<string | null> => {
  const innerAc = new AbortController();
  const timer = setTimeout(() => innerAc.abort(), perRequestMs);
  const onOuter = () => innerAc.abort();
  signal.addEventListener('abort', onOuter);
  try {
    const r = await fetch(url, {
      credentials: 'include',
      signal: innerAc.signal,
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onOuter);
  }
};

const fetchJson = async (
  url: string,
  signal: AbortSignal,
  perRequestMs = 8_000,
): Promise<unknown | null> => {
  const innerAc = new AbortController();
  const timer = setTimeout(() => innerAc.abort(), perRequestMs);
  const onOuter = () => innerAc.abort();
  signal.addEventListener('abort', onOuter);
  try {
    const r = await fetch(url, {
      credentials: 'include',
      signal: innerAc.signal,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onOuter);
  }
};

const broadcast = (msg: Message) => {
  chrome.runtime.sendMessage(msg).catch(() => {});
};

/**
 * Run the MAIN-world collector inside the target tab. Runs in page context
 * so `fetch('https://api.encar.com/...')` succeeds with the page's own
 * Origin + cookies — the exact same way Encar's own JS calls these endpoints.
 */
const runMainWorldCollect = async (
  tabId: number,
): Promise<MainWorldPayload | null> => {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: mainWorldCollect,
    });
    const first = results[0];
    if (!first) return null;
    return (first.result as MainWorldPayload) ?? null;
  } catch (err) {
    console.error('[daksin] executeScript failed', err);
    return null;
  }
};

interface CollectInput {
  preloadedState: unknown;
  nextData?: unknown;
  recordJson?: unknown;
  diagnosisJson?: unknown;
  inspectionJson?: unknown;
  httpStatus?: {
    recordJson?: FetchStatus;
    diagnosisJson?: FetchStatus;
    inspectionJson?: FetchStatus;
  };
}

const collectFor = async (
  carId: string,
  url: string,
  opts: { tabId?: number; inPageData?: CollectInput },
): Promise<Message> => {
  const db = getDb();
  const cached = await db.cache.get(carId);
  if (cached && cached.expiresAt > Date.now()) {
    // facts/report는 규칙 엔진이 계속 바뀔 수 있으므로 매 캐시 히트마다
    // parsed로부터 재계산한다. (cache에 남은 구버전 보고서를 그대로 리턴하면
    // 규칙 로직 업데이트가 화면에 반영되지 않아 혼란스럽다.)
    const facts = encarToFacts(cached.parsed);
    const report = evaluate(facts);
    return {
      type: 'COLLECT_RESULT',
      carId,
      parsed: cached.parsed,
      facts,
      report,
    };
  }

  broadcast({ type: 'COLLECT_PROGRESS', carId, stage: 'fetching_reports' });

  // Prefer the payload sent by the content script (it already executed in the
  // page's main world and captured __PRELOADED_STATE__ + api.encar.com JSON).
  // Fall back to chrome.scripting.executeScript when invoked from the side
  // panel without an upstream content script payload.
  let input: CollectInput | null = opts.inPageData ?? null;
  if (!input && opts.tabId !== undefined) {
    const payload = await runMainWorldCollect(opts.tabId);
    if (payload) {
      input = {
        preloadedState: payload.preloadedState,
        nextData: payload.nextData,
        recordJson: payload.recordJson,
        diagnosisJson: payload.diagnosisJson,
        inspectionJson: payload.inspectionJson,
        httpStatus: payload.httpStatus,
      };
    }
  }
  if (!input) {
    return {
      type: 'COLLECT_ERROR',
      carId,
      reason: 'no_in_page_data',
    };
  }

  const parsed = orchestrate({
    url,
    carId,
    preloadedRoot: {
      __PRELOADED_STATE__: input.preloadedState,
      __NEXT_DATA__: input.nextData,
    },
    recordJson: input.recordJson ?? undefined,
    diagnosisJson: input.diagnosisJson ?? undefined,
    inspectionJson: input.inspectionJson ?? undefined,
    httpStatus: input.httpStatus,
    loginState: 'unknown',
  });

  const facts = encarToFacts(parsed);
  const report = evaluate(facts);

  const now = Date.now();
  await db.cache.put({
    carId,
    url,
    parsed,
    facts,
    report,
    cachedAt: now,
    expiresAt: now + CACHE_TTL_MS,
  });

  return { type: 'COLLECT_RESULT', carId, parsed, facts, report };
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!isMessage(msg)) return false;

  const runCollectJob = (
    carId: string,
    url: string,
    opts: { tabId?: number; inPageData?: CollectInput },
    sendResponse: (msg: Message) => void,
  ) => {
    broadcast({ type: 'COLLECT_PROGRESS', carId, stage: 'start' });
    const watchdog = new Promise<Message>((resolve) => {
      setTimeout(
        () =>
          resolve({
            type: 'COLLECT_ERROR',
            carId,
            reason: 'watchdog_timeout',
          }),
        18_000,
      );
    });
    Promise.race([
      collectFor(carId, url, opts).catch(
        (err): Message => ({
          type: 'COLLECT_ERROR',
          carId,
          reason: String(err),
        }),
      ),
      watchdog,
    ]).then((result) => {
      try {
        sendResponse(result);
      } catch {
        /* port may be closed */
      }
      broadcast(result);
    });
  };

  if (msg.type === 'COLLECT_REQUEST') {
    runCollectJob(
      msg.carId,
      msg.url,
      { tabId: sender.tab?.id, inPageData: msg.inPageData },
      sendResponse,
    );
    return true;
  }

  if (msg.type === 'COLLECT_FOR_TAB') {
    runCollectJob(msg.carId, msg.url, { tabId: msg.tabId }, sendResponse);
    return true;
  }

  if (msg.type === 'REFRESH') {
    getDb().cache.delete(msg.carId).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'GET_LAST') {
    (async () => {
      const db = getDb();
      const row = msg.carId
        ? await db.cache.get(msg.carId)
        : (await db.cache.orderBy('cachedAt').reverse().limit(1).toArray())[0];
      if (!row) {
        sendResponse(null);
        return;
      }
      // 캐시에 저장된 facts/report는 규칙 로직이 바뀌면 즉시 stale이 된다.
      // parsed만 신뢰하고 매 조회마다 facts/report를 재계산해서 최신 룰 버전을
      // 항상 반영한다. (확장 reload만 하면 바로 새 메시지가 화면에 뜸.)
      const facts = encarToFacts(row.parsed);
      const report = evaluate(facts);
      sendResponse({ ...row, facts, report });
    })();
    return true;
  }

  if (msg.type === 'ACK_RULE') {
    const now = Date.now();
    getDb()
      .acks.put({
        carId: msg.carId,
        ruleId: msg.ruleId,
        ackedAt: now,
        expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  return false;
});

// Daily sweep of expired rows.
chrome.alarms?.create('sweep-expired', { periodInMinutes: 60 * 24 });
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sweep-expired') {
    sweepExpired().catch(() => {});
  }
});

// Open side panel on action click.
chrome.action?.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    chrome.sidePanel?.open({ tabId: tab.id }).catch(() => {});
  }
});
