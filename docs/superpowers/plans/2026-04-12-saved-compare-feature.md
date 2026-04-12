# Saved & Compare Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the ability to save (bookmark) car listings with 15-day TTL and compare up to 4 cars side-by-side in a dedicated comparison page.

**Architecture:** Extend existing IndexedDB `saved` table with full `EncarParsedData` snapshots. Add 4 new message types to the Chrome messaging protocol. Side panel gets a third "My List" tab; a new `compare.html` extension page renders a full-width comparison table. `facts` and `report` are always recomputed from stored `parsed` on read.

**Tech Stack:** TypeScript, React 18, Dexie (IndexedDB), Chrome Extension Manifest V3, Vite + @crxjs/vite-plugin, Vitest

**Spec:** `docs/superpowers/specs/2026-04-12-saved-compare-feature.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/core/storage/saved.ts` | `SavedRow` type, `SAVED_TTL_MS`, `extractSpecs()` helper, `buildSavedRow()` |
| `src/sidepanel/components/SaveButton.tsx` | Save/unsave toggle button + CSS |
| `src/sidepanel/components/SavedList.tsx` | "My List" tab: card list + compare selection + floating compare button |
| `src/sidepanel/components/SavedCard.tsx` | Individual saved car card + CSS |
| `src/compare/main.tsx` | Compare page React entry point |
| `src/compare/App.tsx` | Compare page root: load data, render table |
| `src/compare/components/CompareTable.tsx` | Main comparison table layout |
| `src/compare/components/SummarySection.tsx` | Verdict + score bar row |
| `src/compare/components/SpecSection.tsx` | Price, year, mileage, fuel rows |
| `src/compare/components/RuleSection.tsx` | Per-rule severity comparison rows |
| `src/compare/compare.html` | Compare page HTML shell |
| `tests/storage-saved.test.ts` | Tests for saved helpers |
| `tests/messaging-saved.test.ts` | Tests for new message type guards |

### Modified files
| File | Changes |
|------|---------|
| `src/core/storage/db.ts` | Extend `SavedRow`, bump Dexie v1→v2, update `sweepExpired` |
| `src/core/messaging/protocol.ts` | Add 4 message types + type guards |
| `src/background/index.ts` | Handle SAVE/UNSAVE/GET_SAVED_LIST/IS_SAVED + revisit-update |
| `src/sidepanel/App.tsx` | Add `'mylist'` tab, `viewingSavedCarId` state, wire save state |
| `src/sidepanel/components/TabBar.tsx` | Add `'mylist'` to `Tab` union, 3-column grid |
| `src/sidepanel/components/ActionBar.tsx` | Add save button prop + 3-column grid |
| `src/manifest.ts` | Register `compare.html` |
| `vite.config.ts` | Add `compare` entry point |

---

## Task 1: Data Model — SavedRow type + spec extraction helper

**Files:**
- Create: `src/core/storage/saved.ts`
- Modify: `src/core/storage/db.ts`
- Test: `tests/storage-saved.test.ts`

- [ ] **Step 1: Write the failing test for `extractSpecs`**

```typescript
// tests/storage-saved.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage-saved.test.ts`
Expected: FAIL — module `@/core/storage/saved` does not exist.

- [ ] **Step 3: Create `src/core/storage/saved.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/storage-saved.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Update Dexie schema in `db.ts`**

In `src/core/storage/db.ts`, re-export the new `SavedRow` type and bump to version 2:

Replace the existing `SavedRow` interface and constructor:

```typescript
// Replace the old SavedRow interface:
// export interface SavedRow {
//   carId: string;
//   url: string;
//   title: string;
//   savedAt: number;
// }
// with:
export type { SavedRow } from './saved.js';
import { SAVED_TTL_MS } from './saved.js';
import type { SavedRow } from './saved.js';
```

Update the constructor:

```typescript
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
```

Update `sweepExpired`:

```typescript
export const sweepExpired = async (now: number = Date.now()): Promise<void> => {
  const db = getDb();
  await db.cache.where('expiresAt').below(now).delete();
  await db.acks.where('expiresAt').below(now).delete();
  await db.saved.where('expiresAt').below(now).delete();
};
```

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/storage/saved.ts src/core/storage/db.ts tests/storage-saved.test.ts
git commit -m "feat(storage): add SavedRow type, extractSpecs helper, Dexie v2 migration"
```

---

## Task 2: Messaging Protocol — 4 new message types

**Files:**
- Modify: `src/core/messaging/protocol.ts`
- Test: `tests/messaging-saved.test.ts`

- [ ] **Step 1: Write the failing test for new type guards**

```typescript
// tests/messaging-saved.test.ts
import { describe, it, expect } from 'vitest';
import {
  isSaveCar,
  isUnsaveCar,
  isGetSavedList,
  isIsSaved,
} from '@/core/messaging/protocol';

describe('saved message type guards', () => {
  it('isSaveCar', () => {
    expect(isSaveCar({ type: 'SAVE_CAR', carId: '1', url: 'u', parsed: {} })).toBe(true);
    expect(isSaveCar({ type: 'REFRESH', carId: '1' })).toBe(false);
  });

  it('isUnsaveCar', () => {
    expect(isUnsaveCar({ type: 'UNSAVE_CAR', carId: '1' })).toBe(true);
    expect(isUnsaveCar({ type: 'SAVE_CAR', carId: '1' })).toBe(false);
  });

  it('isGetSavedList', () => {
    expect(isGetSavedList({ type: 'GET_SAVED_LIST' })).toBe(true);
    expect(isGetSavedList({ type: 'GET_LAST' })).toBe(false);
  });

  it('isIsSaved', () => {
    expect(isIsSaved({ type: 'IS_SAVED', carId: '1' })).toBe(true);
    expect(isIsSaved({ type: 'SAVE_CAR', carId: '1' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/messaging-saved.test.ts`
Expected: FAIL — `isSaveCar` is not exported.

- [ ] **Step 3: Add message types to `protocol.ts`**

Add to the `Message` union in `src/core/messaging/protocol.ts`:

```typescript
  | {
      type: 'SAVE_CAR';
      carId: string;
      url: string;
      parsed: EncarParsedData;
    }
  | { type: 'UNSAVE_CAR'; carId: string }
  | { type: 'GET_SAVED_LIST' }
  | { type: 'IS_SAVED'; carId: string };
```

Add type guards after the existing ones:

```typescript
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

export const isIsSaved = (
  v: unknown,
): v is Extract<Message, { type: 'IS_SAVED' }> =>
  isMessage(v) && v.type === 'IS_SAVED';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/messaging-saved.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/messaging/protocol.ts tests/messaging-saved.test.ts
git commit -m "feat(messaging): add SAVE_CAR, UNSAVE_CAR, GET_SAVED_LIST, IS_SAVED message types"
```

---

## Task 3: Background Handlers — save, unsave, list, check, revisit-update

**Files:**
- Modify: `src/background/index.ts`

- [ ] **Step 1: Add imports**

Add to the top of `src/background/index.ts`:

```typescript
import {
  isSaveCar,
  isUnsaveCar,
  isGetSavedList,
  isIsSaved,
} from '@/core/messaging/protocol';
import { buildSavedRow, SAVED_TTL_MS, extractSpecs } from '@/core/storage/saved';
```

- [ ] **Step 2: Add SAVE_CAR handler**

Add before the `return false;` at the end of the `onMessage` listener:

```typescript
  if (isSaveCar(msg)) {
    const row = buildSavedRow(msg.carId, msg.url, msg.parsed);
    getDb()
      .saved.put(row)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
```

- [ ] **Step 3: Add UNSAVE_CAR handler**

```typescript
  if (isUnsaveCar(msg)) {
    getDb()
      .saved.delete(msg.carId)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
```

- [ ] **Step 4: Add GET_SAVED_LIST handler**

```typescript
  if (isGetSavedList(msg)) {
    (async () => {
      const db = getDb();
      const now = Date.now();
      const rows = await db.saved
        .where('expiresAt')
        .above(now)
        .reverse()
        .sortBy('savedAt');
      const enriched = rows.map((row) => {
        const facts = encarToFacts(row.parsed);
        const report = evaluate(facts);
        return { ...row, facts, report };
      });
      sendResponse(enriched);
    })();
    return true;
  }
```

- [ ] **Step 5: Add IS_SAVED handler**

```typescript
  if (isIsSaved(msg)) {
    getDb()
      .saved.get(msg.carId)
      .then((row) => sendResponse({ saved: !!row && row.expiresAt > Date.now() }))
      .catch(() => sendResponse({ saved: false }));
    return true;
  }
```

- [ ] **Step 6: Add revisit-update logic in `collectFor`**

In the `collectFor` function, after the `db.cache.put(...)` call (around line 185), add:

```typescript
    // Revisit-update: if this car was previously saved, refresh the snapshot.
    const existingSaved = await db.saved.get(carId);
    if (existingSaved && existingSaved.expiresAt > now) {
      await db.saved.update(carId, {
        ...extractSpecs(parsed.raw.base),
        parsed,
        updatedAt: now,
        expiresAt: now + SAVED_TTL_MS,
      });
    }
```

- [ ] **Step 7: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/background/index.ts
git commit -m "feat(background): handle SAVE/UNSAVE/GET_SAVED_LIST/IS_SAVED + revisit-update"
```

---

## Task 4: TabBar — add "My List" tab

**Files:**
- Modify: `src/sidepanel/components/TabBar.tsx`

- [ ] **Step 1: Update Tab type and TABS array**

In `src/sidepanel/components/TabBar.tsx`:

Change the `Tab` type:
```typescript
export type Tab = 'checklist' | 'ai' | 'mylist';
```

Add third entry to `TABS`:
```typescript
const TABS: Array<{ id: Tab; label: string; sub: string }> = [
  { id: 'checklist', label: 'CHECKLIST', sub: '◼ 11 RULES' },
  { id: 'ai', label: 'AI REVIEW', sub: '◇ GEMINI / GPT' },
  { id: 'mylist', label: 'MY LIST', sub: '★ SAVED CARS' },
];
```

- [ ] **Step 2: Update CSS grid**

Change `grid-template-columns: 1fr 1fr;` to `grid-template-columns: 1fr 1fr 1fr;` in the `.tab-bar` CSS.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Errors in `App.tsx` because it doesn't handle `'mylist'` tab yet — that's expected and fixed in Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/components/TabBar.tsx
git commit -m "feat(sidepanel): add 'mylist' tab to TabBar with 3-column grid"
```

---

## Task 5: ActionBar — add save button

**Files:**
- Modify: `src/sidepanel/components/ActionBar.tsx`

- [ ] **Step 1: Update ActionBar to 3-column layout with save button**

Replace the entire `ActionBar.tsx`:

```typescript
import React from 'react';

interface ActionBarProps {
  onRefresh: () => void;
  onGoToAi: () => void;
  saved: boolean;
  onToggleSave: () => void;
}

export const css: string = `
.ab-root {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-top: 4px double #000;
}

.ab-btn {
  padding: 14px;
  font-family: 'Archivo Black', sans-serif;
  font-size: 13px;
  letter-spacing: -0.2px;
  text-align: center;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
}

.ab-btn--refresh {
  background: #fff;
  color: #000;
  border-right: 2px solid #000;
}

.ab-btn--save {
  background: #fff;
  color: #000;
  border-right: 2px solid #000;
}

.ab-btn--save[data-saved='true'] {
  background: #CCFF00;
  color: #000;
}

.ab-btn--ai {
  background: #000;
  color: #fff;
}
`;

export const ActionBar: React.FC<ActionBarProps> = ({
  onRefresh,
  onGoToAi,
  saved,
  onToggleSave,
}) => (
  <div className="ab-root">
    <button className="ab-btn ab-btn--refresh" onClick={onRefresh}>
      ↻ 재평가
    </button>
    <button
      className="ab-btn ab-btn--save"
      data-saved={saved}
      onClick={onToggleSave}
    >
      {saved ? '★ SAVED' : '☆ SAVE'}
    </button>
    <button className="ab-btn ab-btn--ai" onClick={onGoToAi}>
      AI 평가 →
    </button>
  </div>
);
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Errors in `App.tsx` because it doesn't pass the new props yet — fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/components/ActionBar.tsx
git commit -m "feat(sidepanel): add save/unsave toggle button to ActionBar"
```

---

## Task 6: SavedCard + SavedList components

**Files:**
- Create: `src/sidepanel/components/SavedCard.tsx`
- Create: `src/sidepanel/components/SavedList.tsx`

- [ ] **Step 1: Create `SavedCard.tsx`**

```typescript
// src/sidepanel/components/SavedCard.tsx
import React from 'react';
import type { Verdict } from '@/core/types/RuleTypes.js';

export interface SavedCardData {
  carId: string;
  title: string;
  year: number | null;
  mileageKm: number | null;
  priceWon: number | null;
  fuelType: string | null;
  score: number;
  verdict: Verdict;
  killerCount: number;
  warnCount: number;
}

interface SavedCardProps {
  data: SavedCardData;
  selected: boolean;
  onSelect: (carId: string) => void;
  onView: (carId: string) => void;
  onDelete: (carId: string) => void;
}

const VERDICT_COLOR: Record<Verdict, string> = {
  OK: '#00C853',
  CAUTION: '#FFD600',
  NEVER: '#FF1744',
  UNKNOWN: '#9E9E9E',
};

const fmtMileage = (km: number | null): string =>
  km === null ? '—' : km >= 10000 ? `${(km / 10000).toFixed(1)}만km` : `${km.toLocaleString()}km`;

const fmtPrice = (won: number | null): string =>
  won === null ? '—' : `${won.toLocaleString()}만원`;

export const css: string = `
.sc-root {
  border: 3px solid #000;
  border-bottom: none;
  padding: 12px 14px;
  cursor: pointer;
  position: relative;
  transition: background 0.1s;
}
.sc-root:last-child {
  border-bottom: 3px solid #000;
}
.sc-root:hover {
  background: #f5f5f5;
}
.sc-root[data-selected='true'] {
  background: #CCFF00;
}
.sc-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}
.sc-verdict {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
}
.sc-specs {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.sc-title {
  font-family: 'Inter Tight', sans-serif;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sc-price {
  font-family: 'Archivo Black', sans-serif;
  font-size: 15px;
  margin-bottom: 6px;
}
.sc-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.5px;
}
.sc-bar {
  flex: 1;
  height: 6px;
  background: #e0e0e0;
  position: relative;
}
.sc-bar-fill {
  height: 100%;
  background: #000;
}
.sc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.sc-action-btn {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 4px 8px;
  border: 2px solid #000;
  background: #fff;
  cursor: pointer;
}
.sc-action-btn:hover {
  background: #000;
  color: #fff;
}
.sc-checkbox {
  position: absolute;
  top: 12px;
  left: 14px;
  width: 16px;
  height: 16px;
  accent-color: #000;
}
`;

export const SavedCard: React.FC<SavedCardProps> = ({
  data,
  selected,
  onSelect,
  onView,
  onDelete,
}) => {
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
    onView(data.carId);
  };

  return (
    <div
      className="sc-root"
      data-selected={selected}
      onClick={handleCardClick}
    >
      <input
        type="checkbox"
        className="sc-checkbox"
        checked={selected}
        onChange={() => onSelect(data.carId)}
      />
      <div className="sc-top" style={{ paddingLeft: 24 }}>
        <span
          className="sc-verdict"
          style={{ color: VERDICT_COLOR[data.verdict] }}
        >
          [{data.score}] {data.verdict}
        </span>
        <span className="sc-specs">
          {data.year ?? '—'} · {fmtMileage(data.mileageKm)}
        </span>
      </div>
      <div className="sc-title" style={{ paddingLeft: 24 }}>
        {data.title || '—'}{data.fuelType ? ` ${data.fuelType}` : ''}
      </div>
      <div className="sc-price" style={{ paddingLeft: 24 }}>
        {fmtPrice(data.priceWon)}
      </div>
      <div className="sc-bar-row" style={{ paddingLeft: 24 }}>
        <div className="sc-bar">
          <div
            className="sc-bar-fill"
            style={{ width: `${Math.min(data.score, 100)}%` }}
          />
        </div>
        <span>K:{data.killerCount} W:{data.warnCount}</span>
      </div>
      <div className="sc-actions">
        <button
          className="sc-action-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(data.carId); }}
        >
          삭제
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create `SavedList.tsx`**

```typescript
// src/sidepanel/components/SavedList.tsx
import React, { useCallback, useEffect, useState } from 'react';
import type { Message } from '@/core/messaging/protocol.js';
import type { SavedRow } from '@/core/storage/saved.js';
import type { ChecklistFacts } from '@/core/types/ChecklistFacts.js';
import type { RuleReport } from '@/core/types/RuleTypes.js';
import { SavedCard, css as savedCardCss } from './SavedCard.js';
import type { SavedCardData } from './SavedCard.js';

interface EnrichedSavedRow extends SavedRow {
  facts: ChecklistFacts;
  report: RuleReport;
}

interface SavedListProps {
  onViewCar: (carId: string) => void;
}

const MAX_COMPARE = 4;

export const css: string = `
${savedCardCss}
.sl-root {
  padding: 0;
}
.sl-empty {
  padding: 32px 16px;
  text-align: center;
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #666;
}
.sl-compare-float {
  position: sticky;
  bottom: 0;
  padding: 12px;
  background: #000;
  text-align: center;
}
.sl-compare-btn {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  text-transform: uppercase;
  color: #000;
  background: #CCFF00;
  border: none;
  padding: 12px 32px;
  cursor: pointer;
  letter-spacing: 0.5px;
}
.sl-compare-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
`;

export const SavedList: React.FC<SavedListProps> = ({ onViewCar }) => {
  const [rows, setRows] = useState<EnrichedSavedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadList = useCallback(async () => {
    try {
      const resp = (await chrome.runtime.sendMessage<Message>({
        type: 'GET_SAVED_LIST',
      })) as EnrichedSavedRow[];
      setRows(resp ?? []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handleDelete = useCallback(
    async (carId: string) => {
      await chrome.runtime
        .sendMessage<Message>({ type: 'UNSAVE_CAR', carId })
        .catch(() => {});
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(carId);
        return next;
      });
      void loadList();
    },
    [loadList],
  );

  const handleSelect = useCallback((carId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(carId)) {
        next.delete(carId);
      } else if (next.size < MAX_COMPARE) {
        next.add(carId);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selected.size < 2) return;
    const ids = Array.from(selected).join(',');
    const url = chrome.runtime.getURL(`src/compare/compare.html?ids=${ids}`);
    chrome.tabs.create({ url });
  }, [selected]);

  if (loading) {
    return (
      <div className="sl-empty">LOADING...</div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="sl-empty">
        저장된 매물이 없습니다.<br />
        차량 페이지에서 SAVE 버튼을 눌러 추가하세요.
      </div>
    );
  }

  const cards: SavedCardData[] = rows.map((r) => ({
    carId: r.carId,
    title: r.title,
    year: r.year,
    mileageKm: r.mileageKm,
    priceWon: r.priceWon,
    fuelType: r.fuelType,
    score: r.report.score,
    verdict: r.report.verdict,
    killerCount: r.report.killers.length,
    warnCount: r.report.warns.length,
  }));

  return (
    <div className="sl-root">
      {cards.map((c) => (
        <SavedCard
          key={c.carId}
          data={c}
          selected={selected.has(c.carId)}
          onSelect={handleSelect}
          onView={onViewCar}
          onDelete={handleDelete}
        />
      ))}
      {selected.size >= 2 && (
        <div className="sl-compare-float">
          <button className="sl-compare-btn" onClick={handleCompare}>
            COMPARE {selected.size}
          </button>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors (or only `App.tsx` errors from not yet wiring these in — fixed in Task 7).

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/components/SavedCard.tsx src/sidepanel/components/SavedList.tsx
git commit -m "feat(sidepanel): add SavedCard and SavedList components for My List tab"
```

---

## Task 7: Wire up App.tsx — My List tab + save state + viewingSavedCarId

**Files:**
- Modify: `src/sidepanel/App.tsx`

- [ ] **Step 1: Add imports**

Add to `App.tsx`:

```typescript
import { SavedList, css as savedListCss } from './components/SavedList.js';
import type { Message } from '@/core/messaging/protocol.js';
import type { SavedRow } from '@/core/storage/saved.js';
import type { ChecklistFacts } from '@/core/types/ChecklistFacts.js';
import type { RuleReport } from '@/core/types/RuleTypes.js';
```

Add `savedListCss` to the `SHEET` concatenation.

- [ ] **Step 2: Add save state and viewingSavedCarId**

Inside the `App` component, add state:

```typescript
const [savedState, setSavedState] = useState(false);
const [viewingSavedCarId, setViewingSavedCarId] = useState<string | null>(null);
const [savedRow, setSavedRow] = useState<CacheRow | null>(null);
```

Add `IS_SAVED` check effect:

```typescript
useEffect(() => {
  if (!row?.carId) return;
  chrome.runtime
    .sendMessage<Message>({ type: 'IS_SAVED', carId: row.carId })
    .then((resp: any) => setSavedState(resp?.saved ?? false))
    .catch(() => setSavedState(false));
}, [row?.carId]);
```

Add save toggle handler:

```typescript
const handleToggleSave = useCallback(async () => {
  if (!row) return;
  if (savedState) {
    await chrome.runtime
      .sendMessage<Message>({ type: 'UNSAVE_CAR', carId: row.carId })
      .catch(() => {});
    setSavedState(false);
  } else {
    await chrome.runtime
      .sendMessage<Message>({
        type: 'SAVE_CAR',
        carId: row.carId,
        url: row.url,
        parsed: row.parsed,
      })
      .catch(() => {});
    setSavedState(true);
  }
}, [row, savedState]);
```

Add view-saved-car handler (uses already-enriched data from GET_SAVED_LIST — no double recomputation):

```typescript
const handleViewSavedCar = useCallback(async (carId: string) => {
  const resp = (await chrome.runtime.sendMessage<Message>({
    type: 'GET_SAVED_LIST',
  })) as Array<SavedRow & { facts: ChecklistFacts; report: RuleReport }>;
  const found = resp?.find((r) => r.carId === carId);
  if (!found) return;
  // Background already recomputed facts+report in GET_SAVED_LIST handler.
  // Reuse directly — no need to call encarToFacts/evaluate again.
  setSavedRow({
    carId: found.carId,
    url: found.url,
    parsed: found.parsed,
    facts: found.facts,
    report: found.report,
    cachedAt: found.updatedAt,
    expiresAt: found.expiresAt,
  });
  setViewingSavedCarId(carId);
  setTab('checklist');
}, []);
```

- [ ] **Step 3: Update render logic**

The effective data row should be `savedRow` when `viewingSavedCarId` is set, otherwise the live `row`:

```typescript
const effectiveRow = viewingSavedCarId ? savedRow : row;
```

Use `effectiveRow` instead of `row` for Hero, CarStrip, HealthRadar, FilterTabs, RuleGroup, ActionBar, and AiEvaluationPanel.

When `viewingSavedCarId` is set, show a "back to live" banner above the Hero:

```typescript
{viewingSavedCarId && (
  <button
    style={{
      width: '100%',
      padding: '10px',
      fontFamily: "'Space Mono', monospace",
      fontSize: '10px',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      background: '#CCFF00',
      border: 'none',
      borderBottom: '3px solid #000',
      cursor: 'pointer',
    }}
    onClick={() => {
      setViewingSavedCarId(null);
      setSavedRow(null);
    }}
  >
    ← BACK TO LIVE TAB
  </button>
)}
```

- [ ] **Step 4: Update ActionBar props**

```typescript
<ActionBar
  onRefresh={refresh}
  onGoToAi={() => setTab('ai')}
  saved={savedState}
  onToggleSave={handleToggleSave}
/>
```

- [ ] **Step 5: Add My List tab rendering**

```typescript
{tab === 'mylist' && (
  <SavedList onViewCar={handleViewSavedCar} />
)}
```

- [ ] **Step 6: Clear viewingSavedCarId on tab change if active tab URL changes**

Reset `viewingSavedCarId` when the active tab data changes:

```typescript
useEffect(() => {
  if (viewingSavedCarId && active?.carId) {
    // Don't auto-clear — let user explicitly go back
  }
}, [active?.carId]);
```

Actually, clear it when navigating to a different tab:

In the `setTab` call, wrap it:
```typescript
const changeTab = useCallback((t: Tab) => {
  setTab(t);
  if (t !== 'checklist') {
    setViewingSavedCarId(null);
    setSavedRow(null);
  }
}, []);
```

Use `changeTab` in `TabBar onChange` and `ActionBar onGoToAi`.

- [ ] **Step 7: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/sidepanel/App.tsx
git commit -m "feat(sidepanel): wire My List tab, save toggle, and viewingSavedCarId override"
```

---

## Task 8: Compare page — HTML shell + entry point + Vite config

**Files:**
- Create: `src/compare/compare.html`
- Create: `src/compare/main.tsx`
- Modify: `vite.config.ts`
- Modify: `src/manifest.ts`

- [ ] **Step 1: Create `compare.html`**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AutoVerdict — Compare</title>
    <style>
      :root { color-scheme: light; font-family: -apple-system, system-ui, sans-serif; }
      body { margin: 0; padding: 0; background: #fff; color: #000; }
      #app { }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `main.tsx`**

```typescript
// src/compare/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CompareApp } from './App';

const root = document.getElementById('app');
if (root) createRoot(root).render(<CompareApp />);
```

- [ ] **Step 3: Update `vite.config.ts`**

Add `compare` to the `input` object:

```typescript
build: {
  rollupOptions: {
    input: {
      sidepanel: 'src/sidepanel/index.html',
      compare: 'src/compare/compare.html',
    },
  },
},
```

- [ ] **Step 4: Update `manifest.ts`**

No additional manifest entry needed — `@crxjs/vite-plugin` handles extension pages via the Vite input. The page is accessed via `chrome.runtime.getURL('src/compare/compare.html')`.

- [ ] **Step 5: Commit**

```bash
git add src/compare/compare.html src/compare/main.tsx vite.config.ts
git commit -m "feat(compare): add compare.html entry point and Vite config"
```

---

## Task 9: Compare page — App + CompareTable

**Files:**
- Create: `src/compare/App.tsx`
- Create: `src/compare/components/CompareTable.tsx`

- [ ] **Step 1: Create `App.tsx`**

```typescript
// src/compare/App.tsx
import React, { useEffect, useState } from 'react';
import type { Message } from '@/core/messaging/protocol.js';
import type { SavedRow } from '@/core/storage/saved.js';
import type { ChecklistFacts } from '@/core/types/ChecklistFacts.js';
import type { RuleReport } from '@/core/types/RuleTypes.js';
import { CompareTable } from './components/CompareTable.js';

export interface CompareCarData {
  carId: string;
  url: string;
  title: string;
  year: number | null;
  mileageKm: number | null;
  priceWon: number | null;
  fuelType: string | null;
  facts: ChecklistFacts;
  report: RuleReport;
}

interface EnrichedSavedRow extends SavedRow {
  facts: ChecklistFacts;
  report: RuleReport;
}

// Reuse the existing globalCss from sidepanel theme — it includes
// Google Fonts @import and base resets. Same pattern as sidepanel.
import { globalCss } from '@/sidepanel/theme.js';

export const CompareApp: React.FC = () => {
  const [cars, setCars] = useState<CompareCarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = params.get('ids')?.split(',').filter(Boolean) ?? [];
    if (ids.length < 2) {
      setError('비교할 차량을 2대 이상 선택해 주세요.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const resp = (await chrome.runtime.sendMessage<Message>({
          type: 'GET_SAVED_LIST',
        })) as EnrichedSavedRow[];
        const matched = ids
          .map((id) => resp.find((r) => r.carId === id))
          .filter((r): r is EnrichedSavedRow => !!r);
        if (matched.length < 2) {
          setError('저장된 차량을 찾을 수 없습니다. 목록을 확인해 주세요.');
          setLoading(false);
          return;
        }
        setCars(
          matched.map((r) => ({
            carId: r.carId,
            url: r.url,
            title: r.title,
            year: r.year,
            mileageKm: r.mileageKm,
            priceWon: r.priceWon,
            fuelType: r.fuelType,
            facts: r.facts,
            report: r.report,
          })),
        );
      } catch {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#000' }}>
      <style>{globalCss}</style>
      <header
        style={{
          padding: '24px 32px',
          borderBottom: '4px solid #000',
          fontFamily: "'Archivo Black', sans-serif",
          fontSize: '24px',
          textTransform: 'uppercase',
          letterSpacing: '-0.5px',
        }}
      >
        AutoVerdict Compare
      </header>
      {loading && (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            fontFamily: "'Space Mono', monospace",
            fontSize: '12px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}
        >
          LOADING...
        </div>
      )}
      {error && (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: '14px',
            color: '#666',
          }}
        >
          {error}
        </div>
      )}
      {!loading && !error && cars.length >= 2 && (
        <CompareTable cars={cars} />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Create `CompareTable.tsx`**

```typescript
// src/compare/components/CompareTable.tsx
import React from 'react';
import type { CompareCarData } from '../App.js';
import type { Verdict, Severity } from '@/core/types/RuleTypes.js';
import { RULE_META } from '@/sidepanel/rule-meta.js';

const VERDICT_COLOR: Record<Verdict, string> = {
  OK: '#00C853',
  CAUTION: '#FFD600',
  NEVER: '#FF1744',
  UNKNOWN: '#9E9E9E',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  pass: 'PASS',
  warn: 'WARN',
  fail: 'FAIL',
  killer: 'KILLER',
  unknown: '—',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  pass: '#00C853',
  warn: '#FFD600',
  fail: '#FF1744',
  killer: '#FF1744',
  unknown: '#9E9E9E',
};

const fmtMileage = (km: number | null): string =>
  km === null ? '—' : km >= 10000 ? `${(km / 10000).toFixed(1)}만km` : `${km.toLocaleString()}km`;

const fmtPrice = (won: number | null): string =>
  won === null ? '—' : `${won.toLocaleString()}만원`;

const css = `
.ct-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Inter Tight', sans-serif;
  font-size: 13px;
}
.ct-table th,
.ct-table td {
  border: 2px solid #000;
  padding: 10px 14px;
  text-align: center;
  vertical-align: middle;
}
.ct-table th {
  font-family: 'Archivo Black', sans-serif;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #000;
  color: #fff;
}
.ct-label {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  text-align: left;
  background: #f5f5f5;
  font-weight: 700;
  white-space: nowrap;
}
.ct-section-header {
  font-family: 'Archivo Black', sans-serif;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  background: #000;
  color: #CCFF00;
  text-align: left;
}
.ct-diff {
  background: #FFFDE7;
}
.ct-verdict {
  font-family: 'Archivo Black', sans-serif;
  font-size: 16px;
}
.ct-score-bar {
  display: inline-block;
  width: 80px;
  height: 8px;
  background: #e0e0e0;
  position: relative;
  vertical-align: middle;
}
.ct-score-fill {
  height: 100%;
  background: #000;
}
.ct-link {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.5px;
  color: #000;
}
`;

interface CompareTableProps {
  cars: CompareCarData[];
}

export const CompareTable: React.FC<CompareTableProps> = ({ cars }) => {
  // Collect all rule IDs across all cars
  const allRuleIds = Array.from(
    new Set(cars.flatMap((c) => c.report.results.map((r) => r.ruleId))),
  ).sort();

  // Check if severities differ in a rule row
  const hasDiff = (ruleId: string): boolean => {
    const severities = cars.map((c) => {
      const r = c.report.results.find((r) => r.ruleId === ruleId);
      return r?.severity ?? 'unknown';
    });
    return new Set(severities).size > 1;
  };

  const colCount = cars.length + 1;

  return (
    <div style={{ padding: '0 24px 48px', overflowX: 'auto' }}>
      <style>{css}</style>
      <table className="ct-table">
        <thead>
          <tr>
            <th style={{ width: '140px' }}></th>
            {cars.map((c) => (
              <th key={c.carId}>
                <div>{c.title || c.carId}</div>
                <a
                  className="ct-link"
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#CCFF00' }}
                >
                  엔카에서 보기 →
                </a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Section: Summary */}
          <tr>
            <td className="ct-section-header" colSpan={colCount}>
              Summary
            </td>
          </tr>
          <tr>
            <td className="ct-label">Verdict</td>
            {cars.map((c) => (
              <td key={c.carId}>
                <span
                  className="ct-verdict"
                  style={{ color: VERDICT_COLOR[c.report.verdict] }}
                >
                  {c.report.verdict}
                </span>
              </td>
            ))}
          </tr>
          <tr>
            <td className="ct-label">Score</td>
            {cars.map((c) => (
              <td key={c.carId}>
                <strong>{c.report.score}</strong>
                <div style={{ marginTop: 4 }}>
                  <span className="ct-score-bar">
                    <span
                      className="ct-score-fill"
                      style={{ width: `${Math.min(c.report.score, 100)}%` }}
                    />
                  </span>
                </div>
              </td>
            ))}
          </tr>

          {/* Section: Specs */}
          <tr>
            <td className="ct-section-header" colSpan={colCount}>
              Specs
            </td>
          </tr>
          <tr>
            <td className="ct-label">Price</td>
            {cars.map((c) => (
              <td key={c.carId} style={{ fontWeight: 600 }}>
                {fmtPrice(c.priceWon)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="ct-label">Year</td>
            {cars.map((c) => (
              <td key={c.carId}>{c.year ?? '—'}</td>
            ))}
          </tr>
          <tr>
            <td className="ct-label">Mileage</td>
            {cars.map((c) => (
              <td key={c.carId}>{fmtMileage(c.mileageKm)}</td>
            ))}
          </tr>
          <tr>
            <td className="ct-label">Fuel</td>
            {cars.map((c) => (
              <td key={c.carId}>{c.fuelType ?? '—'}</td>
            ))}
          </tr>

          {/* Section: Rules */}
          <tr>
            <td className="ct-section-header" colSpan={colCount}>
              Rules
            </td>
          </tr>
          {allRuleIds.map((ruleId) => {
            const diff = hasDiff(ruleId);
            const meta = RULE_META[ruleId];
            return (
              <tr key={ruleId} className={diff ? 'ct-diff' : ''}>
                <td className="ct-label">
                  {ruleId} {meta?.title ?? ''}
                </td>
                {cars.map((c) => {
                  const result = c.report.results.find(
                    (r) => r.ruleId === ruleId,
                  );
                  const sev = result?.severity ?? 'unknown';
                  return (
                    <td key={c.carId}>
                      <span style={{ color: SEVERITY_COLOR[sev], fontWeight: 700 }}>
                        {SEVERITY_LABEL[sev]}
                      </span>
                      {result && sev !== 'pass' && sev !== 'unknown' && (
                        <div
                          style={{
                            fontSize: '10px',
                            color: '#666',
                            marginTop: 2,
                          }}
                        >
                          {result.message}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Check that `dist/` contains both `sidepanel/index.html` and `compare/compare.html`.

- [ ] **Step 5: Commit**

```bash
git add src/compare/App.tsx src/compare/components/CompareTable.tsx
git commit -m "feat(compare): add CompareApp and CompareTable with summary/specs/rules sections"
```

---

## Task 10: Manual E2E verification

- [ ] **Step 1: Load extension in Chrome**

1. Run `npm run build`
2. Open `chrome://extensions/`, enable Developer Mode
3. Load unpacked → select `dist/`

- [ ] **Step 2: Test save flow**

1. Navigate to an Encar listing (`fem.encar.com/cars/detail/*`)
2. Open side panel → verify evaluation loads
3. Click "SAVE" in ActionBar → button should change to "SAVED" with yellow background
4. Switch to "MY LIST" tab → card should appear with correct score, verdict, specs

- [ ] **Step 3: Test unsave flow**

1. On the checklist tab, click "SAVED" → should revert to "SAVE"
2. Switch to "MY LIST" tab → card should be gone

- [ ] **Step 4: Test card click (view saved car)**

1. Save 1+ cars, switch to MY LIST tab
2. Click a card body → should switch to checklist tab showing that car's evaluation
3. "BACK TO LIVE TAB" banner should appear at top
4. Click the banner → should return to the current tab's live evaluation

- [ ] **Step 5: Test compare flow**

1. Save 2+ cars
2. In MY LIST tab, check 2 cards → "COMPARE 2" floating button should appear
3. Click COMPARE → new tab opens with compare table
4. Verify: summary (verdict + score), specs (price, year, mileage, fuel), rules (R01–R11) are correct
5. Verify difference highlighting on rows where severities differ

- [ ] **Step 6: Test revisit-update**

1. Save a car, note the data
2. Navigate away, then return to the same listing
3. The side panel should re-collect → check MY LIST tab to verify `updatedAt` refreshed

- [ ] **Step 7: Test expiry**

Verify in DevTools → Application → IndexedDB → autoverdict → saved:
- `expiresAt` is ~15 days from `savedAt`
- After revisit, `expiresAt` is reset

- [ ] **Step 8: Final commit**

If any fixes were needed during testing:

```bash
git add -A
git commit -m "fix: address issues found during manual E2E testing"
```

---

## Summary

| Task | Description | Files | Est. |
|------|-------------|-------|------|
| 1 | SavedRow type + extractSpecs + Dexie v2 | 3 files | Core data layer |
| 2 | 4 new message types + type guards | 2 files | Messaging |
| 3 | Background handlers + revisit-update | 1 file | Background |
| 4 | TabBar 3-column | 1 file | UI prep |
| 5 | ActionBar save button | 1 file | UI prep |
| 6 | SavedCard + SavedList | 2 files | UI components |
| 7 | App.tsx wiring | 1 file | Integration |
| 8 | Compare HTML + entry + Vite | 3 files | Compare setup |
| 9 | CompareApp + CompareTable | 2 files | Compare UI |
| 10 | Manual E2E verification | — | Verification |

**Build order:** Tasks 1–3 are core (no UI dependency). Tasks 4–7 are side panel UI. Tasks 8–9 are compare page. Task 10 is verification. Tasks within each group are sequential; the three groups can be done in order 1-3 → 4-7 → 8-9 → 10.
