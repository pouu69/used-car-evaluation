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
import {
  isCollectForTab,
  isCollectRequest,
  isMessage,
  type Message,
} from '@/core/messaging/protocol';
import { SAVED_TTL_MS, extractSpecs } from '@/core/storage/saved';
import {
  mainWorldCollect,
  type MainWorldPayload,
  type FetchStatus,
} from './main-world-collector';
import {
  handleRefresh,
  handleGetLast,
  handleAckRule,
  handleSaveCar,
  handleUnsaveCar,
  handleGetSavedList,
  handleGetSavedOne,
  handleIsSaved,
  refreshSavedRowIfExists,
} from './handlers';
import { createLogger } from '@/core/log';

const logger = createLogger('autoverdict:bg');

/**
 * Shared fetch-with-timeout helper. Combines an outer abort signal with an
 * inner per-request timeout and a pluggable response parser. Errors, aborts
 * and non-2xx responses all collapse to `null` — the caller is responsible
 * for treating `null` as "unavailable".
 */
const fetchWithTimeout = async <T>(
  url: string,
  signal: AbortSignal,
  parse: (r: Response) => Promise<T>,
  perRequestMs = 8_000,
): Promise<T | null> => {
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
    return await parse(r);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onOuter);
  }
};

// Thin wrappers preserved for future consumers; fetchWithTimeout is the
// single source of truth for timeout / abort / error semantics.
export const fetchText = (
  url: string,
  signal: AbortSignal,
  perRequestMs = 8_000,
): Promise<string | null> =>
  fetchWithTimeout(url, signal, (r) => r.text(), perRequestMs);

export const fetchJson = <T = unknown>(
  url: string,
  signal: AbortSignal,
  perRequestMs = 8_000,
): Promise<T | null> =>
  fetchWithTimeout<T>(url, signal, (r) => r.json() as Promise<T>, perRequestMs);

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
    logger.error('executeScript failed', err);
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
    const facts = encarToFacts(cached.parsed);
    const report = evaluate(facts);
    return { type: 'COLLECT_RESULT', carId, parsed: cached.parsed, facts, report };
  }

  broadcast({ type: 'COLLECT_PROGRESS', carId, stage: 'fetching_reports' });

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
    return { type: 'COLLECT_ERROR', carId, reason: 'no_in_page_data' };
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

  await refreshSavedRowIfExists(carId, parsed);

  return { type: 'COLLECT_RESULT', carId, parsed, facts, report };
};

const WATCHDOG_MS = 18_000;

const runCollectJob = (
  carId: string,
  url: string,
  opts: { tabId?: number; inPageData?: CollectInput },
  sendResponse: (msg: Message) => void,
) => {
  broadcast({ type: 'COLLECT_PROGRESS', carId, stage: 'start' });
  const watchdog = new Promise<Message>((resolve) => {
    setTimeout(
      () => resolve({ type: 'COLLECT_ERROR', carId, reason: 'watchdog_timeout' }),
      WATCHDOG_MS,
    );
  });
  Promise.race([
    collectFor(carId, url, opts).catch(
      (err): Message => ({ type: 'COLLECT_ERROR', carId, reason: String(err) }),
    ),
    watchdog,
  ]).then((result) => {
    try { sendResponse(result); } catch { /* port may be closed */ }
    broadcast(result);
  });
};

// ── Message type → handler dispatch map ─────────────────────────

type AsyncHandler = (msg: never, sender: chrome.runtime.MessageSender) => Promise<unknown>;

const messageHandlers: Record<string, AsyncHandler> = {
  REFRESH: (msg) => handleRefresh(msg as Extract<Message, { type: 'REFRESH' }>),
  GET_LAST: (msg) => handleGetLast(msg as Extract<Message, { type: 'GET_LAST' }>),
  ACK_RULE: (msg) => handleAckRule(msg as Extract<Message, { type: 'ACK_RULE' }>),
  SAVE_CAR: (msg) => handleSaveCar(msg as Extract<Message, { type: 'SAVE_CAR' }>),
  UNSAVE_CAR: (msg) => handleUnsaveCar(msg as Extract<Message, { type: 'UNSAVE_CAR' }>),
  GET_SAVED_LIST: () => handleGetSavedList(),
  GET_SAVED_ONE: (msg) => handleGetSavedOne(msg as Extract<Message, { type: 'GET_SAVED_ONE' }>),
  IS_SAVED: (msg) => handleIsSaved(msg as Extract<Message, { type: 'IS_SAVED' }>),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!isMessage(msg)) return false;

  // Collect messages need special handling (watchdog race, broadcast).
  if (isCollectRequest(msg)) {
    runCollectJob(
      msg.carId, msg.url,
      { tabId: sender.tab?.id, inPageData: msg.inPageData },
      sendResponse,
    );
    return true;
  }
  if (isCollectForTab(msg)) {
    runCollectJob(msg.carId, msg.url, { tabId: msg.tabId }, sendResponse);
    return true;
  }

  // All other message types go through the dispatch map.
  const handler = messageHandlers[msg.type];
  if (handler) {
    handler(msg as never, sender)
      .then((result) => sendResponse(result))
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
