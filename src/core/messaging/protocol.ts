/**
 * Cross-context messaging contract.
 * content script ↔ background service worker ↔ side panel
 */
import type { EncarParsedData } from '../types/ParsedData.js';
import type { RuleReport } from '../types/RuleTypes.js';
import type { ChecklistFacts } from '../types/ChecklistFacts.js';

/** HTTP status for each api.encar.com fetch, shared across contexts. */
export type FetchStatus =
  | 'ok'
  | 'not_found'
  | 'unauthorized'
  | 'error'
  | 'skipped';

export interface InPageData {
  preloadedState: unknown;
  nextData?: unknown;
  /** JSON payloads fetched in-page from api.encar.com (page-context, CORS-OK). */
  recordJson?: unknown;
  diagnosisJson?: unknown;
  inspectionJson?: unknown;
  /** Per-endpoint HTTP status to distinguish 404 (personal listing) from error. */
  httpStatus?: {
    recordJson?: FetchStatus;
    diagnosisJson?: FetchStatus;
    inspectionJson?: FetchStatus;
  };
}

export type Message =
  | {
      type: 'COLLECT_REQUEST';
      carId: string;
      url: string;
      inPageData: InPageData;
    }
  | {
      type: 'COLLECT_FOR_TAB';
      carId: string;
      url: string;
      tabId: number;
    }
  | { type: 'COLLECT_PROGRESS'; carId: string; stage: string }
  | {
      type: 'COLLECT_RESULT';
      carId: string;
      parsed: EncarParsedData;
      facts: ChecklistFacts;
      report: RuleReport;
    }
  | { type: 'COLLECT_ERROR'; carId: string; reason: string }
  | { type: 'ACK_RULE'; carId: string; ruleId: string }
  | { type: 'REFRESH'; carId: string }
  | { type: 'GET_LAST'; carId?: string }
  | { type: 'SAVE_CAR'; carId: string; url: string; parsed: EncarParsedData }
  | { type: 'UNSAVE_CAR'; carId: string }
  | { type: 'GET_SAVED_LIST' }
  | { type: 'GET_SAVED_ONE'; carId: string }
  | { type: 'IS_SAVED'; carId: string };

export const isMessage = (v: unknown): v is Message =>
  typeof v === 'object' &&
  v !== null &&
  'type' in v &&
  typeof (v as { type: unknown }).type === 'string';

export const isCollectRequest = (
  v: unknown,
): v is Extract<Message, { type: 'COLLECT_REQUEST' }> =>
  isMessage(v) && v.type === 'COLLECT_REQUEST';

export const isCollectForTab = (
  v: unknown,
): v is Extract<Message, { type: 'COLLECT_FOR_TAB' }> =>
  isMessage(v) && v.type === 'COLLECT_FOR_TAB';

export const isCollectProgress = (
  v: unknown,
): v is Extract<Message, { type: 'COLLECT_PROGRESS' }> =>
  isMessage(v) && v.type === 'COLLECT_PROGRESS';

export const isCollectResult = (
  v: unknown,
): v is Extract<Message, { type: 'COLLECT_RESULT' }> =>
  isMessage(v) && v.type === 'COLLECT_RESULT';

export const isCollectError = (
  v: unknown,
): v is Extract<Message, { type: 'COLLECT_ERROR' }> =>
  isMessage(v) && v.type === 'COLLECT_ERROR';

export const isAckRule = (
  v: unknown,
): v is Extract<Message, { type: 'ACK_RULE' }> =>
  isMessage(v) && v.type === 'ACK_RULE';

export const isRefresh = (
  v: unknown,
): v is Extract<Message, { type: 'REFRESH' }> =>
  isMessage(v) && v.type === 'REFRESH';

export const isGetLast = (
  v: unknown,
): v is Extract<Message, { type: 'GET_LAST' }> =>
  isMessage(v) && v.type === 'GET_LAST';

export const isSaveCar = (
  v: unknown,
): v is Extract<Message, { type: 'SAVE_CAR' }> =>
  isMessage(v) && v.type === 'SAVE_CAR';

export const isUnsaveCar = (
  v: unknown,
): v is Extract<Message, { type: 'UNSAVE_CAR' }> =>
  isMessage(v) && v.type === 'UNSAVE_CAR';

export const isGetSavedList = (
  v: unknown,
): v is Extract<Message, { type: 'GET_SAVED_LIST' }> =>
  isMessage(v) && v.type === 'GET_SAVED_LIST';

export const isGetSavedOne = (
  v: unknown,
): v is Extract<Message, { type: 'GET_SAVED_ONE' }> =>
  isMessage(v) && v.type === 'GET_SAVED_ONE';

export const isIsSaved = (
  v: unknown,
): v is Extract<Message, { type: 'IS_SAVED' }> =>
  isMessage(v) && v.type === 'IS_SAVED';
