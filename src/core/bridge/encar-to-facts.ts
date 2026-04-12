/**
 * Layer C — Bridge from EncarParsedData to ChecklistFacts.
 *
 * Invariants:
 *  - F1: 법인 ≠ 렌트. R05 is derived from record.loan/business/government flags
 *    exclusive of any corporation flag.
 *  - F2: Accident costs come from record.myAccidentCost/otherAccidentCost
 *    (structured integers), not from insurance HTML heuristics.
 *  - F3: Dealer vs personal is a BRANCH, not an attribute. Personal listings
 *    (CLIENT) cannot buy Encar's paid diagnosis and their inspection API
 *    endpoint returns 404, so R03 and R04 must resolve to "not applicable"
 *    instead of KILLER FAIL. See Sample 006 for the full motivation.
 */
import type { ChecklistFacts } from '../types/ChecklistFacts.js';
import type {
  DetailFlags,
  EncarCarBase,
  EncarParsedData,
} from '../types/ParsedData.js';
import type { FieldStatus } from '../types/FieldStatus.js';
import { failed, isValue, value } from '../types/FieldStatus.js';
import { getInsuranceGapPeriods } from '../parsers/encar/api-record.js';
import { getFrameIntact } from '../parsers/encar/api-diagnosis.js';
import {
  getFrameFromInspection,
  getOilLeakItems,
  getOuterPanelParts,
} from '../parsers/encar/api-inspection.js';

/**
 * True when the listing is posted by an individual (CLIENT) rather than a
 * dealer. Canonical definition — do not replicate its pieces elsewhere:
 *
 *   - `detailFlags.isDealer === false`, OR
 *   - `base.contact.userType === 'CLIENT'`, OR
 *   - both (strongest signal — observed on sample 006).
 *
 * `contact.userType` wins when `isDealer` is absent (older API responses),
 * and `isDealer` wins when `contact.userType` is absent (new fixtures). If
 * neither is present we conservatively return `false` (assume dealer),
 * because treating a dealer as personal would under-flag real killer risks.
 */
/**
 * Inclusive month count between two `YYYY-MM` strings.
 * e.g. `2025-08` ~ `2025-12` → 5 (Aug, Sep, Oct, Nov, Dec).
 * Returns 0 if either input is malformed or `to` precedes `from`.
 */
export const monthsBetweenInclusive = (from: string, to: string): number => {
  const m1 = /^(\d{4})-(\d{2})$/.exec(from);
  const m2 = /^(\d{4})-(\d{2})$/.exec(to);
  if (!m1 || !m2) return 0;
  const y1 = Number(m1[1]);
  const mo1 = Number(m1[2]);
  const y2 = Number(m2[1]);
  const mo2 = Number(m2[2]);
  const diff = (y2 - y1) * 12 + (mo2 - mo1) + 1;
  return diff > 0 ? diff : 0;
};

export const isPersonalListing = (
  base: FieldStatus<EncarCarBase>,
  flags: FieldStatus<DetailFlags>,
): boolean => {
  const flagIsDealer = isValue(flags) ? flags.value.isDealer : undefined;
  if (flagIsDealer === false) return true;
  if (flagIsDealer === true) return false;
  const userType = isValue(base) ? base.value.contact?.userType : undefined;
  return userType === 'CLIENT';
};

export const encarToFacts = (parsed: EncarParsedData): ChecklistFacts => {
  const warnings: string[] = [];
  const facts: ChecklistFacts = {
    schemaVersion: 1,
    derivedFrom: 'encar',
    bridgeWarnings: warnings,
    insuranceHistoryDisclosed: failed('not_derived'),
    inspectionReportDisclosed: failed('not_derived'),
    hasEncarDiagnosis: failed('not_derived'),
    frameDamage: failed('not_derived'),
    usageHistory: failed('not_derived'),
    totalLossHistory: failed('not_derived'),
    ownerChangeCount: failed('not_derived'),
    insuranceGap: failed('not_derived'),
    unconfirmedAccident: failed('not_derived'),
    minorAccidents: failed('not_derived'),
    priceVsMarket: failed('not_derived'),
    oilLeak: failed('not_derived'),
  };

  const personal = isPersonalListing(parsed.raw.base, parsed.raw.detailFlags);
  if (personal) warnings.push('personal_listing');

  // R01/R02/R03 from __PRELOADED_STATE__.cars.detailFlags
  const flags = parsed.raw.detailFlags;
  if (isValue(flags)) {
    facts.insuranceHistoryDisclosed = value(flags.value.isInsuranceExist);
    facts.inspectionReportDisclosed = value(flags.value.isHistoryView);
    // R03: personal listings cannot obtain Encar diagnosis, so mark the
    // field as "not applicable" rather than FAIL. The rule engine treats
    // any non-value FieldStatus as severity='unknown', which yields UNKNOWN
    // verdict instead of NEVER — the desired behaviour for a fair personal
    // listing assessment.
    if (personal) {
      facts.hasEncarDiagnosis = failed('not_applicable_personal');
      warnings.push('r03_skipped_personal');
    } else {
      facts.hasEncarDiagnosis = value(flags.value.isDiagnosisExist);
    }
  } else {
    facts.insuranceHistoryDisclosed = failed('detail_flags_unavailable');
    facts.inspectionReportDisclosed = failed('detail_flags_unavailable');
    facts.hasEncarDiagnosis = failed('detail_flags_unavailable');
  }

  // R05–R10 from api.encar.com/v1/readside/record/vehicle/{id}/open
  const rec = parsed.raw.recordApi;
  if (isValue(rec)) {
    const r = rec.value;
    facts.usageHistory = value({
      rental: r.loan > 0,
      taxi: r.business > 0,
      business: r.government > 0,
    });
    facts.totalLossHistory = value({
      totalLoss: r.totalLossCnt,
      floodTotal: r.floodTotalLossCnt,
      floodPart: r.floodPartLossCnt ?? 0,
      robber: r.robberCnt,
    });
    facts.ownerChangeCount = value(r.ownerChangeCnt);
    const rawGaps = getInsuranceGapPeriods(r);
    const periods = rawGaps.map((p) => ({
      from: p.from,
      to: p.to,
      months: monthsBetweenInclusive(p.from, p.to),
    }));
    const totalMonths = periods.reduce((acc, p) => acc + p.months, 0);
    facts.insuranceGap = value({
      hasGap: periods.length > 0,
      totalMonths,
      periods,
    });
    facts.unconfirmedAccident = value(false);

    const base = parsed.raw.base;
    const domestic = isValue(base) ? base.value.category.domestic : true;
    facts.minorAccidents = value({
      ownDamageWon: r.myAccidentCost,
      otherDamageWon: r.otherAccidentCost,
      domestic,
    });
  }

  // R04 frame — layered sources, highest authority first.
  //
  //   1. diagnosisApi CHECKER_COMMENT — Encar's own paid diagnosis (dealer only).
  //   2. inspectionApi `master.accdient` — government-mandated 성능점검 report.
  //      Sample 007 is the canonical case: dealer without Encar diagnosis but
  //      with a 성능점검 that explicitly declares `accdient=false`. Before this
  //      layer existed, R04 resolved to UNKNOWN on that listing.
  //   3. ribbon fallback — `isDiagnosisExist=true` implies intact (Encar does
  //      not award the badge to frame-damaged cars).
  const dia = parsed.raw.diagnosisApi;
  if (isValue(dia)) {
    const intact = getFrameIntact(dia.value);
    if (intact === true) {
      facts.frameDamage = value({ hasDamage: false });
    } else if (intact === false) {
      facts.frameDamage = value({ hasDamage: true });
    }
  }
  if (!isValue(facts.frameDamage)) {
    const ins = parsed.raw.inspectionApi;
    if (isValue(ins)) {
      const frame = getFrameFromInspection(ins.value);
      if (frame) {
        const outerParts = getOuterPanelParts(ins.value);
        facts.frameDamage = value({
          hasDamage: frame.hasDamage,
          parts: outerParts.length > 0 ? outerParts : undefined,
        });
        warnings.push(
          frame.simpleRepair
            ? 'frameDamage_from_inspection_simpleRepair'
            : 'frameDamage_from_inspection',
        );
      }
    }
  }
  if (
    !isValue(facts.frameDamage) &&
    isValue(facts.hasEncarDiagnosis) &&
    facts.hasEncarDiagnosis.value
  ) {
    facts.frameDamage = value({ hasDamage: false });
    warnings.push('frameDamage_from_ribbon');
  }

  // R12 — oil leak from 성능점검 inners[] tree.
  const insForLeak = parsed.raw.inspectionApi;
  if (isValue(insForLeak)) {
    const leakItems = getOilLeakItems(insForLeak.value);
    facts.oilLeak = value({
      hasLeak: leakItems.length > 0,
      items: leakItems,
    });
  }

  // R11 — neutral newPrice ratio (no external market API yet).
  const base = parsed.raw.base;
  if (isValue(base)) {
    const b = base.value;
    const priceWon = (b.advertisement.price ?? 0) * 10_000;
    const newPriceWon = (b.category.newPrice ?? 0) * 10_000;
    const ratio = newPriceWon > 0 ? priceWon / newPriceWon : 0;
    facts.priceVsMarket = value({ priceWon, newPriceWon, ratio });
  }

  return facts;
};
