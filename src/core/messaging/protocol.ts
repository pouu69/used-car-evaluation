/**
 * Cross-context messaging contract.
 * content script ↔ background service worker ↔ side panel
 */
import type { EncarParsedData } from '../types/ParsedData.js';
import type { RuleReport } from '../types/RuleTypes.js';
import type { ChecklistFacts } from '../types/ChecklistFacts.js';

export interface InPageData {
  preloadedState: unknown;
  nextData?: unknown;
  /** JSON payloads fetched in-page from api.encar.com (page-context, CORS-OK). */
  recordJson?: unknown;
  diagnosisJson?: unknown;
  inspectionJson?: unknown;
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
  | { type: 'GET_LAST'; carId?: string };

export const isMessage = (v: unknown): v is Message =>
  typeof v === 'object' && v !== null && 'type' in v;
