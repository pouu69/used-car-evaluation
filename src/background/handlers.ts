/**
 * Message handlers — one function per message type.
 * Each handler receives the typed message and returns a promise that
 * resolves with the value to pass back via `sendResponse`.
 *
 * Returning `undefined` means "no response needed" (fire-and-forget).
 */
import { encarToFacts } from '@/core/bridge/encar-to-facts';
import { evaluate } from '@/core/rules/index';
import { getDb } from '@/core/storage/db';
import { buildSavedRow, SAVED_TTL_MS, extractSpecs } from '@/core/storage/saved';
import type { Message } from '@/core/messaging/protocol';

const MAX_SAVED = 10;
const ACK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Cache / collect helpers ─────────────────────────────────────

export const handleRefresh = async (
  msg: Extract<Message, { type: 'REFRESH' }>,
): Promise<{ ok: boolean }> => {
  await getDb().cache.delete(msg.carId).catch(() => {});
  return { ok: true };
};

export const handleGetLast = async (
  msg: Extract<Message, { type: 'GET_LAST' }>,
): Promise<unknown> => {
  const db = getDb();
  const row = msg.carId
    ? await db.cache.get(msg.carId)
    : (await db.cache.orderBy('cachedAt').reverse().limit(1).toArray())[0];
  if (!row) return null;
  const facts = encarToFacts(row.parsed);
  const report = evaluate(facts);
  return { ...row, facts, report };
};

// ── Ack ─────────────────────────────────────────────────────────

export const handleAckRule = async (
  msg: Extract<Message, { type: 'ACK_RULE' }>,
): Promise<{ ok: boolean }> => {
  const now = Date.now();
  await getDb().acks.put({
    carId: msg.carId,
    ruleId: msg.ruleId,
    ackedAt: now,
    expiresAt: now + ACK_TTL_MS,
  });
  return { ok: true };
};

// ── Saved cars ──────────────────────────────────────────────────

export const handleSaveCar = async (
  msg: Extract<Message, { type: 'SAVE_CAR' }>,
): Promise<{ ok: boolean; reason?: string }> => {
  const db = getDb();
  const count = await db.saved.count();
  if (count >= MAX_SAVED) return { ok: false, reason: 'limit' };
  const row = buildSavedRow(msg.carId, msg.url, msg.parsed);
  await db.saved.put(row);
  return { ok: true };
};

export const handleUnsaveCar = async (
  msg: Extract<Message, { type: 'UNSAVE_CAR' }>,
): Promise<{ ok: boolean }> => {
  await getDb().saved.delete(msg.carId);
  return { ok: true };
};

export const handleGetSavedList = async (): Promise<unknown[]> => {
  const db = getDb();
  const now = Date.now();
  const rows = await db.saved.where('expiresAt').above(now).toArray();
  rows.sort((a, b) => b.savedAt - a.savedAt);
  return rows.map((row) => {
    const facts = encarToFacts(row.parsed);
    const report = evaluate(facts);
    return { ...row, facts, report };
  });
};

export const handleGetSavedOne = async (
  msg: Extract<Message, { type: 'GET_SAVED_ONE' }>,
): Promise<unknown> => {
  const db = getDb();
  const row = await db.saved.get(msg.carId);
  if (!row || row.expiresAt <= Date.now()) return null;
  const facts = encarToFacts(row.parsed);
  const report = evaluate(facts);
  return { ...row, facts, report };
};

export const handleIsSaved = async (
  msg: Extract<Message, { type: 'IS_SAVED' }>,
): Promise<{ saved: boolean }> => {
  const db = getDb();
  const now = Date.now();
  const row = await db.saved.get(msg.carId);
  return { saved: !!(row && row.expiresAt > now) };
};

// ── Saved row update (called after collect) ─────────────────────

export const refreshSavedRowIfExists = async (
  carId: string,
  parsed: import('@/core/types/ParsedData').EncarParsedData,
): Promise<void> => {
  const db = getDb();
  const now = Date.now();
  const existingSaved = await db.saved.get(carId);
  if (existingSaved && existingSaved.expiresAt > now) {
    await db.saved.update(carId, {
      ...extractSpecs(parsed.raw.base),
      parsed,
      updatedAt: now,
      expiresAt: now + SAVED_TTL_MS,
    });
  }
};
