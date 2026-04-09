/**
 * Parses `api.encar.com/v1/readside/record/vehicle/{vehicleId}/open` JSON.
 *
 * This API replaces HTML scraping of the accident report page. It returns
 * structured integers and arrays for all rule inputs R05–R10.
 *
 * Observed shape (2026-04-08):
 *   myAccidentCnt:   number   내차 피해 건수
 *   otherAccidentCnt: number  타차 가해 건수
 *   ownerChangeCnt:  number   소유자 변경 횟수 (이미 최초 owner 제외)
 *   robberCnt:       number   도난
 *   totalLossCnt:    number   전손
 *   floodTotalLossCnt: number 침수 전손
 *   floodPartLossCnt: number | null  침수 부분손
 *   government:      number   관용 용도 이력
 *   business:        number   영업(택시) 용도 이력
 *   loan:            number   렌트(대여) 용도 이력
 *   carNoChangeCnt:  number   자동차 번호 변경
 *   myAccidentCost:  number   내차 피해 총 금액(원)
 *   otherAccidentCost: number 타차 가해 총 금액(원)
 *   notJoinDate1..5: string | null  자차보험 미가입 기간(YYYYMM~YYYYMM)
 *   accidentCnt:     number   총 사고 건수
 *   accidents:       Array<{
 *     type: string
 *     date: string
 *     insuranceBenefit: number
 *     partCost: number
 *     laborCost: number
 *     paintingCost: number
 *   }>
 */
import type { FieldStatus } from '../../types/FieldStatus.js';
import { failed, value } from '../../types/FieldStatus.js';
import { isObjectLike } from '../utils/validate.js';
import { formatYearMonth } from '../utils/text.js';

export interface RecordApi {
  myAccidentCnt: number;
  otherAccidentCnt: number;
  ownerChangeCnt: number;
  robberCnt: number;
  totalLossCnt: number;
  floodTotalLossCnt: number;
  floodPartLossCnt: number | null;
  government: number;
  business: number;
  loan: number;
  carNoChangeCnt: number;
  myAccidentCost: number;
  otherAccidentCost: number;
  notJoinDate1: string | null;
  notJoinDate2: string | null;
  notJoinDate3: string | null;
  notJoinDate4: string | null;
  notJoinDate5: string | null;
  accidentCnt: number;
  accidents: Array<{
    type: string;
    date: string;
    insuranceBenefit: number;
    partCost: number;
    laborCost: number;
    paintingCost: number;
  }>;
  openData?: boolean;
}

const hasNumberField = (o: unknown, key: string): boolean =>
  typeof (o as Record<string, unknown>)?.[key] === 'number';

export const parseRecordApi = (json: unknown): FieldStatus<RecordApi> => {
  if (!json || typeof json !== 'object') {
    return failed('record_api_empty');
  }
  // Sanity-check a few required fields to guard against schema drift.
  const required = ['myAccidentCnt', 'otherAccidentCnt', 'ownerChangeCnt'];
  for (const k of required) {
    if (!hasNumberField(json, k)) {
      return failed(`record_api_missing_${k}`);
    }
  }
  return value(json as RecordApi);
};

/** Extract R08 insurance gap periods from notJoinDate1..5. */
export const getInsuranceGapPeriods = (
  r: RecordApi,
): Array<{ from: string; to: string }> => {
  const raw = [
    r.notJoinDate1,
    r.notJoinDate2,
    r.notJoinDate3,
    r.notJoinDate4,
    r.notJoinDate5,
  ].filter((s): s is string => !!s && s.trim().length > 0);
  const out: Array<{ from: string; to: string }> = [];
  for (const s of raw) {
    // Format: "202508~202512"
    const m = /(\d{6})\s*~\s*(\d{6})/.exec(s);
    if (m && m[1] && m[2]) {
      const from = formatYearMonth(m[1], '-');
      const to = formatYearMonth(m[2], '-');
      if (from && to) out.push({ from, to });
    }
  }
  return out;
};
