/**
 * MAIN world content script. Runs in the page's JS context so:
 *   1. `window.__PRELOADED_STATE__` is directly accessible.
 *   2. `fetch('https://api.encar.com/...')` uses the page's Origin and cookies,
 *      matching exactly how Encar's own JS calls these endpoints.
 *
 * MAIN world cannot use `chrome.runtime`. Results are handed to the isolated
 * content script via `window.postMessage`. A single in-flight collect promise
 * is shared across all callers so concurrent posts never duplicate fetches.
 */
declare global {
  interface Window {
    __PRELOADED_STATE__?: unknown;
  }
}

/**
 * HTTP status for each api.encar.com call.
 *
 * `'ok'`            — 2xx + valid JSON body.
 * `'not_found'`     — 404. Personal (CLIENT) listings return 404 from
 *                     `/diagnosis/` and `/inspection/` because those
 *                     endpoints only exist for dealer-attached cars.
 * `'unauthorized'`  — 401/403, login required.
 * `'error'`         — 5xx, network failure, parse error, or timeout.
 * `'skipped'`       — call was never attempted (e.g. no vehicleId).
 */
export type FetchStatus =
  | 'ok'
  | 'not_found'
  | 'unauthorized'
  | 'error'
  | 'skipped';

interface Payload {
  preloadedState: unknown;
  nextData: unknown;
  recordJson: unknown;
  diagnosisJson: unknown;
  inspectionJson: unknown;
  httpStatus: {
    recordJson: FetchStatus;
    diagnosisJson: FetchStatus;
    inspectionJson: FetchStatus;
  };
  errors: Record<string, string>;
}

const log = (...args: unknown[]) => console.log('[autoverdict:main]', ...args);

const readNextData = (): unknown => {
  const el = document.getElementById('__NEXT_DATA__');
  if (!el || !el.textContent) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
};

type FetchResult = { body: unknown | null; status: FetchStatus };

const safeFetchJson = async (url: string): Promise<FetchResult> => {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 7_000);
  try {
    // NO `credentials: 'include'` — api.encar.com's CORS config rejects the
    // preflight that option triggers. Default fetch already sends first-party
    // cookies for same-site navigations (api.encar.com is same-site with
    // fem.encar.com), which is what Encar's own JS relies on.
    const r = await fetch(url, { signal: ac.signal });
    if (r.status === 404) {
      log('fetch 404 (personal listing?)', url);
      return { body: null, status: 'not_found' };
    }
    if (r.status === 401 || r.status === 403) {
      log('fetch unauthorized', url, r.status);
      return { body: null, status: 'unauthorized' };
    }
    if (!r.ok) {
      log('fetch not ok', url, r.status);
      return { body: null, status: 'error' };
    }
    try {
      return { body: await r.json(), status: 'ok' };
    } catch (e) {
      log('fetch parse error', url, String(e));
      return { body: null, status: 'error' };
    }
  } catch (e) {
    log('fetch error', url, String(e));
    return { body: null, status: 'error' };
  } finally {
    clearTimeout(t);
  }
};

const doCollect = async (): Promise<Payload> => {
  const errors: Record<string, string> = {};
  const state = window.__PRELOADED_STATE__ ?? null;
  log('collect start, hasState=', !!state);

  const base = (state as {
    cars?: { base?: { vehicleId?: number; vehicleNo?: string } };
  } | null)?.cars?.base;
  const vehicleId =
    base && typeof base.vehicleId === 'number' ? base.vehicleId : undefined;
  const vehicleNo = base?.vehicleNo;
  log('vehicleId=', vehicleId, 'vehicleNo=', vehicleNo);

  let recordJson: unknown = null;
  let diagnosisJson: unknown = null;
  let inspectionJson: unknown = null;
  const httpStatus: Payload['httpStatus'] = {
    recordJson: 'skipped',
    diagnosisJson: 'skipped',
    inspectionJson: 'skipped',
  };

  if (vehicleId !== undefined) {
    const tasks: Array<Promise<void>> = [];
    if (vehicleNo) {
      tasks.push(
        safeFetchJson(
          `https://api.encar.com/v1/readside/record/vehicle/${vehicleId}/open?vehicleNo=${encodeURIComponent(
            vehicleNo,
          )}`,
        ).then((r) => {
          recordJson = r.body;
          httpStatus.recordJson = r.status;
          if (r.status !== 'ok') errors.recordJson = r.status;
        }),
      );
    } else {
      errors.vehicleNo = 'missing';
    }
    tasks.push(
      safeFetchJson(
        `https://api.encar.com/v1/readside/diagnosis/vehicle/${vehicleId}`,
      ).then((r) => {
        diagnosisJson = r.body;
        httpStatus.diagnosisJson = r.status;
        if (r.status !== 'ok') errors.diagnosisJson = r.status;
      }),
    );
    tasks.push(
      safeFetchJson(
        `https://api.encar.com/v1/readside/inspection/vehicle/${vehicleId}`,
      ).then((r) => {
        inspectionJson = r.body;
        httpStatus.inspectionJson = r.status;
        if (r.status !== 'ok') errors.inspectionJson = r.status;
      }),
    );
    await Promise.all(tasks);
  } else {
    errors.vehicleId = 'missing_from_preloaded_state';
  }

  log('collect done', {
    hasRecord: !!recordJson,
    hasDiagnosis: !!diagnosisJson,
    hasInspection: !!inspectionJson,
    httpStatus,
    errors,
  });

  return {
    preloadedState: state,
    nextData: readNextData(),
    recordJson,
    diagnosisJson,
    inspectionJson,
    httpStatus,
    errors,
  };
};

/**
 * Shared in-flight promise. Subsequent calls return the same promise, so a
 * single `collect()` execution answers both the auto-fire on load AND any
 * number of request_state messages from the isolated script.
 */
let inflight: Promise<Payload> | null = null;
const getPayload = (): Promise<Payload> => {
  if (!inflight) inflight = doCollect();
  return inflight;
};

const post = async (reqId: string | null): Promise<void> => {
  const payload = await getPayload();
  window.postMessage(
    { source: 'autoverdict/main-world', kind: 'state', reqId, payload },
    '*',
  );
};

// Prime the shared promise immediately so the fetches start as early as possible.
void post(null);

// Respond to explicit requests from the isolated script.
window.addEventListener('message', (e: MessageEvent) => {
  const data = e.data;
  if (
    e.source === window &&
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: string }).source === 'autoverdict/isolated' &&
    (data as { kind?: string }).kind === 'request_state'
  ) {
    const reqId = (data as { reqId?: string }).reqId ?? null;
    log('request_state received, reqId=', reqId);
    void post(reqId);
  }
});

export {};
