/**
 * IndexedDB schema via Dexie.
 * 4 tables — cache(24h), acks(7d), saved(15d), settings(infinite).
 */
import Dexie, { type Table } from 'dexie';
import type { EncarParsedData } from '../types/ParsedData.js';
import type { ChecklistFacts } from '../types/ChecklistFacts.js';
import type { RuleReport } from '../types/RuleTypes.js';
export type { SavedRow } from './saved.js';
import type { SavedRow } from './saved.js';

export interface CacheRow {
  carId: string;
  url: string;
  parsed: EncarParsedData;
  facts: ChecklistFacts;
  report: RuleReport;
  cachedAt: number;
  expiresAt: number;
}

export interface AckRow {
  carId: string;
  ruleId: string;
  ackedAt: number;
  expiresAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export class AutoVerdictDB extends Dexie {
  cache!: Table<CacheRow, string>;
  acks!: Table<AckRow, [string, string]>;
  saved!: Table<SavedRow, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('autoverdict');
    this.version(1).stores({
      cache: 'carId, cachedAt, expiresAt',
      acks: '[carId+ruleId], expiresAt',
      saved: 'carId, savedAt',
      settings: 'key',
    });
    this.version(2).stores({
      cache: 'carId, cachedAt, expiresAt',
      acks: '[carId+ruleId], expiresAt',
      saved: 'carId, savedAt, expiresAt',
      settings: 'key',
    }).upgrade(tx => tx.table('saved').clear());
  }
}

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const ACK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let _db: AutoVerdictDB | null = null;
export const getDb = (): AutoVerdictDB => {
  if (!_db) _db = new AutoVerdictDB();
  return _db;
};

export const sweepExpired = async (now: number = Date.now()): Promise<void> => {
  const db = getDb();
  await db.cache.where('expiresAt').below(now).delete();
  await db.acks.where('expiresAt').below(now).delete();
  await db.saved.where('expiresAt').below(now).delete();
};
