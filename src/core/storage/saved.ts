// src/core/storage/saved.ts
import type { FieldStatus } from '../types/FieldStatus.js';
import type { EncarCarBase, EncarParsedData } from '../types/ParsedData.js';
import { isValue } from '../types/FieldStatus.js';

export const SAVED_TTL_MS = 15 * 24 * 60 * 60 * 1000;

export interface SpecSnapshot {
  title: string;
  year: number | null;
  mileageKm: number | null;
  priceWon: number | null;
  fuelType: string | null;
}

export interface SavedRow extends SpecSnapshot {
  carId: string;
  url: string;
  savedAt: number;
  expiresAt: number;
  updatedAt: number;
  parsed: EncarParsedData;
}

/** Extract display-friendly spec fields from a FieldStatus<EncarCarBase>. */
export const extractSpecs = (base: FieldStatus<EncarCarBase>): SpecSnapshot => {
  if (!isValue(base)) {
    return { title: '', year: null, mileageKm: null, priceWon: null, fuelType: null };
  }
  const b = base.value;
  const parts = [b.category.manufacturerName, b.category.modelName];
  if (b.category.gradeName) parts.push(b.category.gradeName);
  const title = parts.join(' ');

  const year = b.category.formYear
    ? Number(b.category.formYear)
    : b.category.yearMonth
      ? Number(b.category.yearMonth.slice(0, 4))
      : null;

  return {
    title,
    year,
    mileageKm: b.spec.mileage ?? null,
    priceWon: b.advertisement.price ?? null,
    fuelType: b.spec.fuelName ?? null,
  };
};

/** Build a complete SavedRow from parsed data. */
export const buildSavedRow = (
  carId: string,
  url: string,
  parsed: EncarParsedData,
  now: number = Date.now(),
): SavedRow => ({
  carId,
  url,
  ...extractSpecs(parsed.raw.base),
  savedAt: now,
  expiresAt: now + SAVED_TTL_MS,
  updatedAt: now,
  parsed,
});
