/**
 * Parses `api.encar.com/v1/readside/inspection/vehicle/{vehicleId}` JSON.
 *
 * This is the 성능점검 report in structured form. Covers R02 (report
 * disclosure) and provides cross-checks for R04/R06.
 *
 * Observed shape:
 *   master.accdient (sic) : boolean   사고이력
 *   master.simpleRepair   : boolean   단순수리
 *   master.detail.tuning  : boolean
 *   master.detail.recall  : boolean
 *   master.detail.waterlog: boolean   침수
 *   master.detail.usageChangeTypes : Array<{code, title}>
 *   master.detail.seriousTypes     : Array<{code, title}>  특별이력
 *   master.detail.paintPartTypes   : Array<{code, title}>  판금 부위
 *   master.detail.mileage: number
 */
import type { FieldStatus } from '../../types/FieldStatus.js';
import { failed, value } from '../../types/FieldStatus.js';

export interface InspectionApi {
  vehicleId: number;
  master?: {
    /** Note: intentional typo as returned by the API. */
    accdient?: boolean;
    simpleRepair?: boolean;
    detail?: {
      tuning?: boolean;
      recall?: boolean;
      waterlog?: boolean;
      mileage?: number;
      usageChangeTypes?: Array<{ code: string; title: string }>;
      seriousTypes?: Array<{ code: string; title: string }>;
      paintPartTypes?: Array<{ code: string; title: string }>;
    };
  };
}

export const parseInspectionApi = (
  json: unknown,
): FieldStatus<InspectionApi> => {
  if (!json || typeof json !== 'object') return failed('inspection_api_empty');
  return value(json as InspectionApi);
};

/**
 * Frame-damage judgment derived from the government-mandated 성능점검 report.
 *
 *   `master.accdient === true`  → frame accident on record        (R04 FAIL)
 *   `master.accdient === false` → no frame accident               (R04 PASS)
 *   anything else               → unknown (caller should fallback)
 *
 * `master.simpleRepair === true` does NOT imply frame damage — it marks
 * outer-panel bolt-on replacements (door, fender, bonnet, trunk) which the
 * Encar data model treats as distinct from frame sheet welding. Sample 007
 * is the canonical reference: `accdient=false && simpleRepair=true` still
 * verdicts R04 PASS.
 *
 * Returns `null` when the signal is absent so the bridge can fall through
 * to the next-lower-priority source (the ribbon heuristic).
 */
export const getFrameFromInspection = (
  ins: InspectionApi,
): { hasDamage: boolean; simpleRepair: boolean } | null => {
  const master = ins.master;
  if (!master || typeof master.accdient !== 'boolean') return null;
  return {
    hasDamage: master.accdient,
    simpleRepair: master.simpleRepair === true,
  };
};
