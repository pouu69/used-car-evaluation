/**
 * Source registry — identity, priority, and constraints for every raw data
 * source the collectors layer can read from.
 *
 * The 4-layer pipeline is:
 *
 *   Collectors (this directory) → Parsers → Bridge → Rules
 *
 * Collectors know WHERE data lives and HOW to fetch it. Parsers know HOW to
 * interpret the payload into `FieldStatus<T>`. Bridge merges per-field
 * statuses from multiple parsers into site-agnostic `ChecklistFacts`.
 *
 * A `SourceId` is stamped onto every `FieldStatus<T>` so the merge layer can
 * (a) pick the highest-priority successful source, (b) detect conflicts
 * across sources for cross-validation, and (c) surface provenance to the UI.
 *
 * This file is side-effect free. Nothing here touches `window`, `fetch`, or
 * `chrome.*`. The actual fetching lives in `src/background/main-world-collector.ts`
 * and `src/content/fem-encar/main-world.ts`.
 */

/**
 * Stable identifier for a single data source. These strings are persisted
 * into IndexedDB cache rows and appear in `bridgeWarnings`, so **never rename
 * an existing value** — always add new ones.
 */
export type SourceId =
  | 'preloaded_state' // window.__PRELOADED_STATE__.cars.base + detailFlags
  | 'next_data' // window.__NEXT_DATA__.props.pageProps (fallback)
  | 'record_api' // api.encar.com/v1/readside/record/vehicle/{id}/open
  | 'diagnosis_api' // api.encar.com/v1/readside/diagnosis/vehicle/{id}
  | 'inspection_api' // api.encar.com/v1/readside/inspection/vehicle/{id}
  | 'main_dom' // fem.encar.com detail page innerText fallback
  | 'history_ui_data' // car.encar.com/history?carId={id} → uiData
  | 'fetch_interceptor' // page-injected XHR/fetch monkey-patch capture
  | 'manual'; // user-entered override

/**
 * Where this source's payload can be obtained from.
 *
 *  - `page_state`    : a JS global on the page (no network)
 *  - `page_dom`      : DOM text extraction on the page
 *  - `main_world_fetch`: fetch issued from the page's own JS context (via
 *    `chrome.scripting.executeScript({ world: 'MAIN' })`) — this is what
 *    lets us hit `api.encar.com` without triggering a CORS preflight, because
 *    the Origin header is `https://fem.encar.com` (same-site with api.*)
 *  - `background_fetch`: plain `fetch()` from the service worker — works for
 *    same-origin HTML but fails for api.encar.com under CORS
 *  - `injected_script` : a `<script>` tag injected into the page that
 *    monkey-patches `window.fetch` / `XMLHttpRequest.prototype.open` to
 *    capture requests the page issues itself
 */
export type AcquisitionMode =
  | 'page_state'
  | 'page_dom'
  | 'main_world_fetch'
  | 'background_fetch'
  | 'injected_script';

export interface SourceMeta {
  id: SourceId;
  /** Higher = preferred when multiple sources report the same field. */
  priority: number;
  acquisition: AcquisitionMode;
  /** Requires an authenticated Encar session? */
  requiresLogin: boolean;
  /** Human-readable description for logs and the UI "source" tooltip. */
  description: string;
}

/**
 * Priorities are chosen so structured API payloads beat heuristic DOM scrapes,
 * and the 1st-party page state beats both. Ties are broken by insertion order.
 */
export const SOURCE_REGISTRY: Readonly<Record<SourceId, SourceMeta>> = {
  preloaded_state: {
    id: 'preloaded_state',
    priority: 100,
    acquisition: 'page_state',
    requiresLogin: false,
    description: '__PRELOADED_STATE__.cars on fem.encar.com detail page',
  },
  record_api: {
    id: 'record_api',
    priority: 95,
    acquisition: 'main_world_fetch',
    requiresLogin: false,
    description: 'api.encar.com accident/owner history (R05–R10)',
  },
  diagnosis_api: {
    id: 'diagnosis_api',
    priority: 95,
    acquisition: 'main_world_fetch',
    requiresLogin: false,
    description: 'api.encar.com frame/panel diagnosis (R03, R04)',
  },
  inspection_api: {
    id: 'inspection_api',
    priority: 95,
    acquisition: 'main_world_fetch',
    requiresLogin: false,
    description: 'api.encar.com official inspection report (R02, R06, R12)',
  },
  history_ui_data: {
    id: 'history_ui_data',
    priority: 80,
    acquisition: 'background_fetch',
    requiresLogin: true,
    description: 'car.encar.com/history uiData (legacy fallback)',
  },
  next_data: {
    id: 'next_data',
    priority: 70,
    acquisition: 'page_state',
    requiresLogin: false,
    description: '__NEXT_DATA__ hydration blob (fallback for state extractor)',
  },
  fetch_interceptor: {
    id: 'fetch_interceptor',
    priority: 60,
    acquisition: 'injected_script',
    requiresLogin: false,
    description: 'XHR/fetch capture from the page itself (experimental)',
  },
  main_dom: {
    id: 'main_dom',
    priority: 30,
    acquisition: 'page_dom',
    requiresLogin: false,
    description: 'innerText + data-enlog-dt-* anchors on the detail page',
  },
  manual: {
    id: 'manual',
    priority: 1000,
    acquisition: 'page_state',
    requiresLogin: false,
    description: 'User-entered override — always wins',
  },
} as const;

export const getSourceMeta = (id: SourceId): SourceMeta => SOURCE_REGISTRY[id];

/** Sort descending by priority (manual > preloaded > api > dom). */
export const bySourcePriority = (a: SourceId, b: SourceId): number =>
  SOURCE_REGISTRY[b].priority - SOURCE_REGISTRY[a].priority;
