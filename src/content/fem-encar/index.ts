/**
 * Isolated world content script. Relays the page's main-world payload
 * (including api.encar.com JSON already fetched in page context) to the
 * background service worker.
 */
import { isRefresh, type Message } from '@/core/messaging/protocol';
import type { MainWorldPayload } from '@/core/messaging/main-world';
import { extractCarId as extractCarIdFromUrl } from '@/core/encar/url';
import { createLogger } from '@/core/log';

const logger = createLogger('autoverdict:content');

const extractCarId = (): string | null =>
  extractCarIdFromUrl(location.href);

/**
 * Narrow type guard for the `window.postMessage` envelope we receive from the
 * MAIN-world script. Returns the payload when the shape is valid, otherwise
 * `null` so the caller can ignore unrelated messages safely.
 */
const parseMainWorldMessage = (
  data: unknown,
  expectedReqId: string,
): { payload: MainWorldPayload | null } | null => {
  if (typeof data !== 'object' || data === null) return null;
  const obj = data as {
    source?: unknown;
    kind?: unknown;
    reqId?: unknown;
    payload?: unknown;
  };
  if (obj.source !== 'autoverdict/main-world' || obj.kind !== 'state') {
    return null;
  }
  const { reqId } = obj;
  if (reqId !== expectedReqId && reqId !== null) return null;
  return { payload: (obj.payload as MainWorldPayload | undefined) ?? null };
};

let lastCarId: string | null = null;
let lastUrl: string | null = null;
let inflight = false;

const requestMainWorldPayload = (
  reqId: string,
): Promise<MainWorldPayload | null> =>
  new Promise((resolve) => {
    let done = false;
    const finish = (p: MainWorldPayload | null) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMessage);
      resolve(p);
    };
    // Accept any well-formed main-world state message: the initial one (reqId
    // null) AND any reqId-matched reply. This avoids waiting for a specific
    // reqId reply when main-world already cached the payload.
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window) return;
      const parsed = parseMainWorldMessage(e.data, reqId);
      if (parsed) finish(parsed.payload);
    };
    window.addEventListener('message', onMessage);
    window.postMessage(
      { source: 'autoverdict/isolated', kind: 'request_state', reqId },
      '*',
    );
    setTimeout(() => finish(null), 15_000);
  });

const collect = async (force = false): Promise<void> => {
  const carId = extractCarId();
  if (!carId) return;
  if (inflight && !force) return;
  if (
    !force &&
    carId === lastCarId &&
    location.href === lastUrl
  ) {
    return;
  }
  inflight = true;
  lastCarId = carId;
  lastUrl = location.href;

  try {
    const reqId = `r${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    logger.log('collect start', { carId, reqId });
    const payload = await requestMainWorldPayload(reqId);
    if (!payload) {
      logger.warn('main-world payload null (timeout)');
      return;
    }
    logger.log('payload received', {
      hasState: !!payload.preloadedState,
      hasRecord: !!payload.recordJson,
      hasDiagnosis: !!payload.diagnosisJson,
      hasInspection: !!payload.inspectionJson,
      errors: payload.errors,
    });

    const msg: Message = {
      type: 'COLLECT_REQUEST',
      carId,
      url: location.href,
      inPageData: {
        preloadedState: payload.preloadedState,
        nextData: payload.nextData,
        recordJson: payload.recordJson,
        diagnosisJson: payload.diagnosisJson,
        inspectionJson: payload.inspectionJson,
        httpStatus: payload.httpStatus,
      },
    };
    chrome.runtime.sendMessage(msg).catch((e) =>
      logger.error('sendMessage failed', e),
    );
  } finally {
    setTimeout(() => {
      inflight = false;
    }, 500);
  }
};

// SPA navigation detection — patch history API.
const patch = (name: 'pushState' | 'replaceState') => {
  const original = history[name].bind(history) as History[typeof name];
  history[name] = function (
    this: History,
    ...args: Parameters<History[typeof name]>
  ) {
    const ret = (original as (...a: typeof args) => void).apply(this, args);
    window.dispatchEvent(new Event('autoverdict:urlchange'));
    return ret;
  } as History[typeof name];
};
patch('pushState');
patch('replaceState');

const onUrlChange = () => void collect(true);
window.addEventListener('popstate', onUrlChange);
window.addEventListener('autoverdict:urlchange', onUrlChange);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (isRefresh(msg)) {
    void collect(true);
    sendResponse({ ok: true });
  }
  return false;
});

if (document.readyState === 'complete') {
  void collect();
} else {
  window.addEventListener('load', () => void collect(), { once: true });
}
