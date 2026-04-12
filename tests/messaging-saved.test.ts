import { describe, it, expect } from 'vitest';
import {
  isSaveCar,
  isUnsaveCar,
  isGetSavedList,
  isIsSaved,
} from '../src/core/messaging/protocol.js';

describe('isSaveCar', () => {
  it('returns true for a valid SAVE_CAR message', () => {
    const msg = { type: 'SAVE_CAR', carId: '123', url: 'https://example.com', parsed: {} };
    expect(isSaveCar(msg)).toBe(true);
  });

  it('returns false for other message types', () => {
    expect(isSaveCar({ type: 'UNSAVE_CAR', carId: '123' })).toBe(false);
    expect(isSaveCar({ type: 'GET_LAST' })).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isSaveCar(null)).toBe(false);
    expect(isSaveCar(undefined)).toBe(false);
    expect(isSaveCar('SAVE_CAR')).toBe(false);
  });
});

describe('isUnsaveCar', () => {
  it('returns true for a valid UNSAVE_CAR message', () => {
    expect(isUnsaveCar({ type: 'UNSAVE_CAR', carId: '123' })).toBe(true);
  });

  it('returns false for other message types', () => {
    expect(isUnsaveCar({ type: 'SAVE_CAR', carId: '123', url: '', parsed: {} })).toBe(false);
    expect(isUnsaveCar({ type: 'IS_SAVED', carId: '123' })).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isUnsaveCar(null)).toBe(false);
    expect(isUnsaveCar(42)).toBe(false);
  });
});

describe('isGetSavedList', () => {
  it('returns true for a valid GET_SAVED_LIST message', () => {
    expect(isGetSavedList({ type: 'GET_SAVED_LIST' })).toBe(true);
  });

  it('returns false for other message types', () => {
    expect(isGetSavedList({ type: 'GET_LAST' })).toBe(false);
    expect(isGetSavedList({ type: 'IS_SAVED', carId: '123' })).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isGetSavedList(null)).toBe(false);
    expect(isGetSavedList('GET_SAVED_LIST')).toBe(false);
  });
});

describe('isIsSaved', () => {
  it('returns true for a valid IS_SAVED message', () => {
    expect(isIsSaved({ type: 'IS_SAVED', carId: '123' })).toBe(true);
  });

  it('returns false for other message types', () => {
    expect(isIsSaved({ type: 'GET_SAVED_LIST' })).toBe(false);
    expect(isIsSaved({ type: 'UNSAVE_CAR', carId: '123' })).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isIsSaved(null)).toBe(false);
    expect(isIsSaved(undefined)).toBe(false);
  });
});
