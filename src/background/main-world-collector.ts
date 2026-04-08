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
 */
export interface MainWorldPayload {
  preloadedState: unknown;
  nextData: unknown;
  recordJson: unknown;
  diagnosisJson: unknown;
  inspectionJson: unknown;
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

  const safeJson = async (url: string): Promise<unknown | null> => {
    try {
      // Omit `credentials: 'include'` — api.encar.com rejects the CORS
      // preflight it triggers. Default fetch still sends first-party cookies
      // for api.encar.com (same-site with fem.encar.com).
      const r = await withTimeout(fetch(url), 6_500);
      if (!r || !r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  };

  let recordJson: unknown = null;
  let diagnosisJson: unknown = null;
  let inspectionJson: unknown = null;

  if (vehicleId !== undefined) {
    const tasks: Array<Promise<void>> = [];
    if (vehicleNo) {
      tasks.push(
        safeJson(
          `https://api.encar.com/v1/readside/record/vehicle/${vehicleId}/open?vehicleNo=${encodeURIComponent(
            vehicleNo,
          )}`,
        ).then((j) => {
          recordJson = j;
          if (!j) errors.recordJson = 'null';
        }),
      );
    }
    tasks.push(
      safeJson(
        `https://api.encar.com/v1/readside/diagnosis/vehicle/${vehicleId}`,
      ).then((j) => {
        diagnosisJson = j;
        if (!j) errors.diagnosisJson = 'null';
      }),
    );
    tasks.push(
      safeJson(
        `https://api.encar.com/v1/readside/inspection/vehicle/${vehicleId}`,
      ).then((j) => {
        inspectionJson = j;
        if (!j) errors.inspectionJson = 'null';
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
    errors,
  };
}
