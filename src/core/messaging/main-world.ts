/**
 * Shared types for the MAIN-world collector payload that flows:
 *   main-world script → isolated content script → background service worker.
 *
 * This module is type-only at runtime — it MUST NOT import anything that
 * touches `chrome.*` or the DOM at import time, because `main-world.ts`
 * runs in the page MAIN world where `chrome.runtime` is undefined.
 */
import type { FetchStatus } from './protocol.js';

export type { FetchStatus };

/** Payload handed from MAIN world → isolated content → background. */
export interface MainWorldPayload {
  preloadedState: unknown;
  nextData: unknown;
  recordJson: unknown;
  diagnosisJson: unknown;
  inspectionJson: unknown;
  httpStatus: {
    recordJson: FetchStatus;
    diagnosisJson: FetchStatus;
    inspectionJson: FetchStatus;
  };
  errors: Record<string, string>;
}
