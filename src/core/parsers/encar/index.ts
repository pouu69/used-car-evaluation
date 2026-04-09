/**
 * Orchestrator: combine __PRELOADED_STATE__ (for base + detailFlags) with
 * api.encar.com JSON payloads (for record/diagnosis/inspection). All HTML
 * scraping paths were removed — api.encar.com endpoints are the single source
 * of truth now that CORS works from the page's own context.
 */
import type { EncarParsedData } from '../../types/ParsedData.js';
import type { FieldStatus } from '../../types/FieldStatus.js';
import { failed, isValue } from '../../types/FieldStatus.js';
import type { FetchStatus } from '../../../background/main-world-collector.js';
import { extractBase, extractDetailFlags } from './state.js';
import { parseRecordApi } from './api-record.js';
import { parseDiagnosisApi } from './api-diagnosis.js';
import { parseInspectionApi } from './api-inspection.js';

export interface OrchestratorInputs {
  url: string;
  carId: string;
  preloadedRoot: {
    __PRELOADED_STATE__?: unknown;
    __NEXT_DATA__?: unknown;
  } | null;
  recordJson?: unknown;
  diagnosisJson?: unknown;
  inspectionJson?: unknown;
  /** Per-endpoint HTTP status from the main-world collector. Optional for
   *  back-compat with existing tests that pass raw JSON only. */
  httpStatus?: {
    recordJson?: FetchStatus;
    diagnosisJson?: FetchStatus;
    inspectionJson?: FetchStatus;
  };
  loginState?: 'logged_in' | 'logged_out' | 'unknown';
}

/**
 * Convert an HTTP fetch status to a parse_failed reason string that the
 * rule engine can surface as human-friendly copy. `ok` is the happy path
 * and should never hit this function.
 */
const reasonForStatus = (status: FetchStatus): string => {
  switch (status) {
    case 'not_found':
      return 'no_report_for_personal';
    case 'unauthorized':
      return 'login_required';
    case 'error':
      return 'api_fetch_error';
    case 'skipped':
      return 'not_fetched';
    default:
      return 'not_fetched';
  }
};

/**
 * Helper: pick the right `FieldStatus` for an API payload given its JSON
 * body and HTTP status. Falls back to `failed('not_fetched')` for missing
 * inputs, and delegates to the per-endpoint parser on `ok`.
 */
const resolveApi = <T>(
  json: unknown,
  status: FetchStatus | undefined,
  parse: (j: unknown) => FieldStatus<T>,
): FieldStatus<T> => {
  if (status && status !== 'ok' && status !== 'skipped') {
    return failed<T>(reasonForStatus(status));
  }
  if (json === undefined || json === null) {
    return failed<T>(status ? reasonForStatus(status) : 'not_fetched');
  }
  return parse(json);
};

export const orchestrate = (input: OrchestratorInputs): EncarParsedData => {
  const root = (input.preloadedRoot ?? {}) as Parameters<typeof extractBase>[0];

  const base = extractBase(root);
  const detailFlags = extractDetailFlags(root);

  const recordApi = resolveApi(
    input.recordJson,
    input.httpStatus?.recordJson,
    parseRecordApi,
  );
  const diagnosisApi = resolveApi(
    input.diagnosisJson,
    input.httpStatus?.diagnosisJson,
    parseDiagnosisApi,
  );
  const inspectionApi = resolveApi(
    input.inspectionJson,
    input.httpStatus?.inspectionJson,
    parseInspectionApi,
  );

  const baseValue = isValue(base) ? base.value : undefined;
  const vehicleId =
    baseValue &&
    typeof (baseValue as { vehicleId?: unknown }).vehicleId === 'number'
      ? (baseValue as { vehicleId?: number }).vehicleId
      : undefined;
  const vehicleNo = baseValue?.vehicleNo;

  return {
    schemaVersion: 1,
    source: 'encar',
    url: input.url,
    carId: input.carId,
    ...(vehicleId !== undefined ? { vehicleId } : {}),
    ...(vehicleNo !== undefined ? { vehicleNo } : {}),
    fetchedAt: Date.now(),
    loginState: input.loginState ?? 'unknown',
    raw: {
      base,
      detailFlags,
      recordApi,
      diagnosisApi,
      inspectionApi,
    },
  };
};
