/**
 * Parses `api.encar.com/v1/readside/diagnosis/vehicle/{vehicleId}` JSON.
 *
 * Observed shape:
 *   vehicleId, diagnosisDate, diagnosisNo, centerCode, reservationCenterName,
 *   items: Array<{ code: string; name: string; result: string; resultCode: string | null }>
 *
 * Special items:
 *   - name=CHECKER_COMMENT    → overall judgment text ("무사고" / "사고")
 *   - name=OUTER_PANEL_COMMENT → outer panel summary
 *   - other names are individual parts (FRONT_DOOR_LEFT, HOOD, etc.)
 *
 * resultCode values observed: "NORMAL", null (for comment rows).
 * result (text) values observed: "정상", or free-form Korean judgment text.
 */
import type { FieldStatus } from '../../types/FieldStatus.js';
import { failed, value } from '../../types/FieldStatus.js';
import { isObjectLike } from '../utils/validate.js';

export interface DiagnosisItem {
  code: string;
  name: string;
  result: string;
  resultCode: string | null;
}

export interface DiagnosisApi {
  vehicleId: number;
  items: DiagnosisItem[];
}

export const parseDiagnosisApi = (
  json: unknown,
): FieldStatus<DiagnosisApi> => {
  if (!isObjectLike(json)) return failed('diagnosis_api_empty');
  const items = (json as { items?: unknown }).items;
  if (!Array.isArray(items)) return failed('diagnosis_api_no_items');
  return value(json as unknown as DiagnosisApi);
};

/**
 * Derive the overall accident/no-accident judgment from diagnosis items.
 * Returns true if frame is intact (무사고), false if frame damage detected.
 */
export const getFrameIntact = (d: DiagnosisApi): boolean | undefined => {
  const checker = d.items.find((i) => i.name === 'CHECKER_COMMENT');
  if (checker) {
    if (/무사고/.test(checker.result)) return true;
    if (/사고/.test(checker.result)) return false;
  }
  // Fallback: if every part item is NORMAL, treat as intact.
  const parts = d.items.filter((i) => i.resultCode !== null);
  if (parts.length > 0 && parts.every((i) => i.resultCode === 'NORMAL')) {
    return true;
  }
  const hasDamage = parts.some(
    (i) => i.resultCode === 'EXCHANGE' || i.resultCode === 'REPAIR',
  );
  if (hasDamage) return false;
  return undefined;
};
