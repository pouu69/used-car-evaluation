/**
 * Isolated world content script. Relays the page's main-world payload
 * (including api.encar.com JSON already fetched in page context) to the
 * background service worker.
 */
import type { Message } from '@/core/messaging/protocol';

type FetchStatus =
  | 'ok'
  | 'not_found'
  | 'unauthorized'
  | 'error'
  | 'skipped';

interface MainWorldPayload {
  preloadedState: unknown;
  nextData: unknown;
  recordJson: unknown;
  diagnosisJson: unknown;
  inspectionJson: unknown;
  httpStatus?: {
    recordJson: FetchStatus;
    diagnosisJson: FetchStatus;
    inspectionJson: FetchStatus;
  };
  errors: Record<string, string>;
}

const extractCarId = (): string | null => {
  const m = /\/cars\/detail\/(\d+)/.exec(location.pathname);
  return m?.[1] ?? null;
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
      const data = e.data;
      if (
        e.source === window &&
        typeof data === 'object' &&
        data !== null &&
        (data as { source?: string }).source === 'autoverdict/main-world' &&
        (data as { kind?: string }).kind === 'state'
      ) {
        const inReqId = (data as { reqId?: string | null }).reqId;
        if (inReqId === reqId || inReqId === null) {
          finish((data as { payload?: MainWorldPayload }).payload ?? null);
        }
      }
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
    console.log('[autoverdict:iso] collect start', { carId, reqId });
    const payload = await requestMainWorldPayload(reqId);
    if (!payload) {
      console.warn('[autoverdict:iso] main-world payload null (timeout)');
      return;
    }
    console.log('[autoverdict:iso] payload received', {
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
      console.error('[autoverdict:iso] sendMessage failed', e),
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
  if (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as Message).type === 'REFRESH'
  ) {
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
