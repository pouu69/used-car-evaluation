import { describe, it, expect } from 'vitest';
import { extractSpecs, SAVED_TTL_MS } from '@/core/storage/saved';
import { value, failed } from '@/core/types/FieldStatus';
import type { EncarCarBase } from '@/core/types/ParsedData';

const makeBase = (overrides?: Partial<EncarCarBase>): EncarCarBase => ({
  category: {
    manufacturerName: '현대',
    modelName: '아반떼',
    gradeName: 'AD 1.6',
    yearMonth: '202103',
    formYear: '2021',
    domestic: true,
    newPrice: 2200,
  },
  advertisement: { price: 1850, preVerified: false, trust: [] },
  spec: { mileage: 32000, fuelName: '가솔린' },
  ...overrides,
});

describe('extractSpecs', () => {
  it('extracts all fields when base is value', () => {
    const result = extractSpecs(value(makeBase()));
    expect(result).toEqual({
      title: '현대 아반떼 AD 1.6',
      year: 2021,
      mileageKm: 32000,
      priceWon: 1850,
      fuelType: '가솔린',
    });
  });

  it('returns nulls when base is not value', () => {
    const result = extractSpecs(failed('not_fetched'));
    expect(result).toEqual({
      title: '',
      year: null,
      mileageKm: null,
      priceWon: null,
      fuelType: null,
    });
  });

  it('parses yearMonth when formYear is missing', () => {
    const base = makeBase();
    delete base.category.formYear;
    const result = extractSpecs(value(base));
    expect(result.year).toBe(2021);
  });

  it('handles missing gradeName', () => {
    const base = makeBase();
    delete base.category.gradeName;
    const result = extractSpecs(value(base));
    expect(result.title).toBe('현대 아반떼');
  });
});

describe('SAVED_TTL_MS', () => {
  it('is 15 days in milliseconds', () => {
    expect(SAVED_TTL_MS).toBe(15 * 24 * 60 * 60 * 1000);
  });
});
