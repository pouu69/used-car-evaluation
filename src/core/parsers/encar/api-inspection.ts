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
import { isObjectLike } from '../utils/validate.js';

export interface OuterPanelPart {
  type: { code: string; title: string };
  statusTypes: Array<{ code: string; title: string }>;
  attributes: string[];
}

/**
 * Hierarchical node in the `inners[]` tree of the 성능점검 report.
 * Top-level codes: S00 자기진단 | S01 원동기 | S02 변속기 | S03 동력전달 |
 *                  S04 조향 | S05 제동 | S06 전기 | S07 연료
 *
 * statusType codes (observed):
 *   1 양호 · 2 적정 · 3 없음 · 4 미세누수 · 5 누수 ·
 *   6 미세누유 · 7 누유 · 8 부족 · 9 과다 · 10 불량 · 11 있음
 */
export interface InnerNode {
  type: { code: string; title: string };
  statusType: { code: string; title: string } | null;
  statusItemTypes: Array<{ code: string; title: string }>;
  description: string | null;
  children?: InnerNode[];
}

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
  outers?: OuterPanelPart[];
  inners?: InnerNode[];
}

export const parseInspectionApi = (
  json: unknown,
): FieldStatus<InspectionApi> => {
  if (!isObjectLike(json)) return failed('inspection_api_empty');
  return value(json as unknown as InspectionApi);
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
/**
 * Extracts exterior panel repair/replacement parts from the `outers` array.
 * Each entry is formatted as "부위명(상태)" e.g. "트렁크 리드(교환)".
 * Returns empty array when no outer panel work is recorded.
 */
export const getOuterPanelParts = (ins: InspectionApi): string[] => {
  if (!ins.outers || ins.outers.length === 0) return [];
  return ins.outers.map((o) => {
    const name = o.type.title;
    const statuses = o.statusTypes.map((s) => s.title).join('/');
    return statuses ? `${name}(${statuses})` : name;
  });
};

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

/** Oil leak status codes: 6 = 미세누유 (minor), 7 = 누유 (significant). */
const OIL_LEAK_CODES = new Set(['6', '7']);

export interface OilLeakItem {
  part: string;
  status: string;
}

/**
 * Traverses the `inners[]` tree and collects all nodes whose statusType
 * indicates an oil leak (codes 6/7). Returns an empty array when no leaks
 * are found or when `inners` is absent.
 */
export const getOilLeakItems = (ins: InspectionApi): OilLeakItem[] => {
  if (!ins.inners || ins.inners.length === 0) return [];
  const items: OilLeakItem[] = [];
  const walk = (nodes: InnerNode[]): void => {
    for (const n of nodes) {
      if (n.statusType && OIL_LEAK_CODES.has(n.statusType.code)) {
        items.push({ part: n.type.title, status: n.statusType.title });
      }
      if (n.children) walk(n.children);
    }
  };
  walk(ins.inners);
  return items;
};
