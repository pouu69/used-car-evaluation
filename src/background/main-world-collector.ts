/**
 * This function is injected into the page's MAIN world via
 * `chrome.scripting.executeScript`. It runs inside the tab's own JS context,
 * which means:
 *   - `window.__PRELOADED_STATE__` is directly accessible (page world).
 *   - `fetch('https://api.encar.com/...')` uses the page's Origin + cookies +
 *     Referer, so CORS checks and any auth tokens the page already holds work
 *     the same as the Encar JS itself would.
 *
 * The function returns a serialisable payload containing everything the
 * orchestrator needs. Nothing is written to the DOM.
 *
 * ## Personal-listing handling
 *
 * Personal (CLIENT) listings like sample 006 do **not** have
 * `/readside/diagnosis/vehicle/{id}` or `/readside/inspection/vehicle/{id}`
 * endpoints — those return HTTP 404. The `recordApi` endpoint, however,
 * still works. To avoid confusing "personal listing" with "network error",
 * we propagate the actual HTTP status alongside each payload so the
 * orchestrator can decide whether to surface `'not_applicable_personal'` or
 * a generic `'not_fetched'` reason.
 */
export type FetchStatus =
  | 'ok' // 2xx + JSON parsed
  | 'not_found' // 404 — endpoint intentionally absent (personal listing, deleted, etc.)
  | 'unauthorized' // 401/403 — login required
  | 'error' // 5xx / network / timeout / parse error
  | 'skipped'; // not attempted (e.g. missing vehicleId)

export interface MainWorldPayload {
  preloadedState: unknown;
  nextData: unknown;
  recordJson: unknown;
  diagnosisJson: unknown;
  inspectionJson: unknown;
  /**
   * HTTP status per API call so the bridge can distinguish
   * "intentional 404 on personal" from "flaky network". `'skipped'` when
   * the call was never made (e.g. no vehicleId).
   */
  httpStatus: {
    recordJson: FetchStatus;
    diagnosisJson: FetchStatus;
    inspectionJson: FetchStatus;
  };
  errors: Record<string, string>;
}

/** Do NOT reference any module-scope symbols — this function is stringified. */
export async function mainWorldCollect(): Promise<MainWorldPayload> {
  const errors: Record<string, string> = {};

  // 1) Read PRELOADED_STATE (Redux-style hydration) from the page global.
  const state = (window as unknown as { __PRELOADED_STATE__?: unknown })
    .__PRELOADED_STATE__;

  // 2) Read __NEXT_DATA__ if Encar ever uses Next.js hydration here.
  let nextData: unknown = null;
  const nextEl = document.getElementById('__NEXT_DATA__');
  if (nextEl && nextEl.textContent) {
    try {
      nextData = JSON.parse(nextEl.textContent);
    } catch (e) {
      errors.nextData = String(e);
    }
  }

  // 3) Extract the internal Encar vehicleId + vehicleNo.
  const base = (state as {
    cars?: { base?: { vehicleId?: number; vehicleNo?: string } };
  } | undefined)?.cars?.base;
  const vehicleId = base && typeof base.vehicleId === 'number' ? base.vehicleId : undefined;
  const vehicleNo = base?.vehicleNo;

  // 4) Call api.encar.com endpoints in parallel, each wrapped in its own
  //    timeout and error swallow so one slow call doesn't block the others.
  const withTimeout = async <T>(p: Promise<T>, ms: number): Promise<T | null> => {
    let t: ReturnType<typeof setTimeout> | undefined;
    try {
      return (await Promise.race([
        p,
        new Promise<T>((_res, rej) => {
          t = setTimeout(() => rej(new Error('timeout')), ms);
        }),
      ])) as T;
    } catch {
      return null;
    } finally {
      if (t !== undefined) clearTimeout(t);
    }
  };

  type FetchResult = { body: unknown | null; status: FetchStatus };
  const safeJson = async (url: string): Promise<FetchResult> => {
    try {
      // Omit `credentials: 'include'` — api.encar.com rejects the CORS
      // preflight it triggers. Default fetch still sends first-party cookies
      // for api.encar.com (same-site with fem.encar.com).
      const r = await withTimeout(fetch(url), 6_500);
      if (!r) return { body: null, status: 'error' };
      if (r.status === 404) return { body: null, status: 'not_found' };
      if (r.status === 401 || r.status === 403) {
        return { body: null, status: 'unauthorized' };
      }
      if (!r.ok) return { body: null, status: 'error' };
      try {
        return { body: await r.json(), status: 'ok' };
      } catch {
        return { body: null, status: 'error' };
      }
    } catch {
      return { body: null, status: 'error' };
    }
  };

  let recordJson: unknown = null;
  let diagnosisJson: unknown = null;
  let inspectionJson: unknown = null;
  const httpStatus: MainWorldPayload['httpStatus'] = {
    recordJson: 'skipped',
    diagnosisJson: 'skipped',
    inspectionJson: 'skipped',
  };

  if (vehicleId !== undefined) {
    const tasks: Array<Promise<void>> = [];
    if (vehicleNo) {
      tasks.push(
        safeJson(
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
      errors.recordJson = 'no_vehicleNo';
    }
    tasks.push(
      safeJson(
        `https://api.encar.com/v1/readside/diagnosis/vehicle/${vehicleId}`,
      ).then((r) => {
        diagnosisJson = r.body;
        httpStatus.diagnosisJson = r.status;
        if (r.status !== 'ok') errors.diagnosisJson = r.status;
      }),
    );
    tasks.push(
      safeJson(
        `https://api.encar.com/v1/readside/inspection/vehicle/${vehicleId}`,
      ).then((r) => {
        inspectionJson = r.body;
        httpStatus.inspectionJson = r.status;
        if (r.status !== 'ok') errors.inspectionJson = r.status;
      }),
    );
    await Promise.all(tasks);
  } else {
    errors.vehicleId = 'not_in_preloaded_state';
  }

  return {
    preloadedState: state ?? null,
    nextData,
    recordJson,
    diagnosisJson,
    inspectionJson,
    httpStatus,
    errors,
  };
}
