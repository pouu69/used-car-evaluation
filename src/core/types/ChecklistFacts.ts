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
  /**
   * R06 — KILLER. 전손/침수전손/침수분손/도난 이력 개별 카운트.
   * 어느 하나라도 > 0이면 killer로 취급. 구체적으로 어떤 이력인지
   * R06 메시지에서 노출하기 위해 원본 count를 그대로 보관한다.
   */
  totalLossHistory: FieldStatus<{
    totalLoss: number;
    floodTotal: number;
    floodPart: number;
    robber: number;
  }>;
  /** R07 */
  ownerChangeCount: FieldStatus<number>;
  /**
   * R08 — 자차보험 미가입 기간.
   * `hasGap`은 공백 존재 여부, `totalMonths`는 전 기간 합산 개월수(양끝 포함),
   * `periods`는 개별 구간(YYYY-MM)과 그 구간의 개월수.
   */
  insuranceGap: FieldStatus<{
    hasGap: boolean;
    totalMonths: number;
    periods: Array<{ from: string; to: string; months: number }>;
  }>;
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
  /** R12 — 성능점검 누유 여부 */
  oilLeak: FieldStatus<{
    hasLeak: boolean;
    items: Array<{ part: string; status: string }>;
  }>;
}
