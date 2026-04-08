/**
 * Layer B — site-agnostic checklist facts. Rules consume only this.
 */
import type { FieldStatus } from './FieldStatus.js';

export interface ChecklistFacts {
  schemaVersion: 1;
  derivedFrom: 'encar' | 'kcar' | 'manual';
  bridgeWarnings: string[];

  /** R01 */
  insuranceHistoryDisclosed: FieldStatus<boolean>;
  /** R02 */
  inspectionReportDisclosed: FieldStatus<boolean>;
  /** R03 */
  hasEncarDiagnosis: FieldStatus<boolean>;
  /** R04 */
  frameDamage: FieldStatus<{ hasDamage: boolean; parts?: string[] }>;
  /** R05 — KILLER */
  usageHistory: FieldStatus<{ rental: boolean; taxi: boolean; business: boolean }>;
  /** R06 — KILLER */
  totalLossHistory: FieldStatus<boolean>;
  /** R07 */
  ownerChangeCount: FieldStatus<number>;
  /** R08 — KILLER */
  insuranceGap: FieldStatus<boolean>;
  /** R09 */
  unconfirmedAccident: FieldStatus<boolean>;
  /** R10 */
  minorAccidents: FieldStatus<{
    ownDamageWon: number;
    otherDamageWon: number;
    domestic: boolean;
  }>;
  /** R11 */
  priceVsMarket: FieldStatus<{
    priceWon: number;
    newPriceWon: number;
    ratio: number;
  }>;
}
