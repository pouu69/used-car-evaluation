/**
 * Layer C — Bridge from EncarParsedData to ChecklistFacts.
 *
 * Invariants:
 *  - F1: 법인 ≠ 렌트. R05 is derived from record.loan/business/government flags
 *    exclusive of any corporation flag.
 *  - F2: Accident costs come from record.myAccidentCost/otherAccidentCost
 *    (structured integers), not from insurance HTML heuristics.
 */
import type { ChecklistFacts } from '../types/ChecklistFacts.js';
import type { EncarParsedData } from '../types/ParsedData.js';
import { failed, isValue, value } from '../types/FieldStatus.js';
import { getInsuranceGapPeriods } from '../parsers/encar/api-record.js';
import { getFrameIntact } from '../parsers/encar/api-diagnosis.js';

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
  };

  // R01/R02/R03 from __PRELOADED_STATE__.cars.detailFlags
  const flags = parsed.raw.detailFlags;
  if (isValue(flags)) {
    facts.insuranceHistoryDisclosed = value(flags.value.isInsuranceExist);
    facts.inspectionReportDisclosed = value(flags.value.isHistoryView);
    facts.hasEncarDiagnosis = value(flags.value.isDiagnosisExist);
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
    const totalLoss =
      r.totalLossCnt +
      r.floodTotalLossCnt +
      (r.floodPartLossCnt ?? 0) +
      r.robberCnt;
    facts.totalLossHistory = value(totalLoss > 0);
    facts.ownerChangeCount = value(r.ownerChangeCnt);
    facts.insuranceGap = value(getInsuranceGapPeriods(r).length > 0);
    facts.unconfirmedAccident = value(false);

    const base = parsed.raw.base;
    const domestic = isValue(base) ? base.value.category.domestic : true;
    facts.minorAccidents = value({
      ownDamageWon: r.myAccidentCost,
      otherDamageWon: r.otherAccidentCost,
      domestic,
    });
  }

  // R04 frame — api.encar.com/v1/readside/diagnosis/vehicle/{id}
  const dia = parsed.raw.diagnosisApi;
  if (isValue(dia)) {
    const intact = getFrameIntact(dia.value);
    if (intact === true) {
      facts.frameDamage = value({ hasDamage: false });
    } else if (intact === false) {
      facts.frameDamage = value({ hasDamage: true });
    }
  }
  // Trust the diagnosis ribbon when available and we have no other frame signal:
  // Encar doesn't award `isDiagnosisExist=true` to frame-damaged cars.
  if (
    !isValue(facts.frameDamage) &&
    isValue(facts.hasEncarDiagnosis) &&
    facts.hasEncarDiagnosis.value
  ) {
    facts.frameDamage = value({ hasDamage: false });
    warnings.push('frameDamage_from_ribbon');
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
