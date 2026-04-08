/**
 * Orchestrator: combine __PRELOADED_STATE__ (for base + detailFlags) with
 * api.encar.com JSON payloads (for record/diagnosis/inspection). All HTML
 * scraping paths were removed — api.encar.com endpoints are the single source
 * of truth now that CORS works from the page's own context.
 */
import type { EncarParsedData } from '../../types/ParsedData.js';
import { failed, isValue } from '../../types/FieldStatus.js';
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
  loginState?: 'logged_in' | 'logged_out' | 'unknown';
}

export const orchestrate = (input: OrchestratorInputs): EncarParsedData => {
  const root = (input.preloadedRoot ?? {}) as Parameters<typeof extractBase>[0];

  const base = extractBase(root);
  const detailFlags = extractDetailFlags(root);

  const recordApi =
    input.recordJson !== undefined
      ? parseRecordApi(input.recordJson)
      : failed<never>('not_fetched');
  const diagnosisApi =
    input.diagnosisJson !== undefined
      ? parseDiagnosisApi(input.diagnosisJson)
      : failed<never>('not_fetched');
  const inspectionApi =
    input.inspectionJson !== undefined
      ? parseInspectionApi(input.inspectionJson)
      : failed<never>('not_fetched');

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
