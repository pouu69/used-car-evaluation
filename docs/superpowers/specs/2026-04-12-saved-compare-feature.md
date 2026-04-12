# Saved & Compare Feature — Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Scope:** `src/core/storage/`, `src/core/messaging/`, `src/background/`, `src/sidepanel/`, `src/compare/` (new)

## Overview

Add the ability to save (bookmark) car listings and compare them side-by-side. Two UI surfaces:

1. **Side panel "My List" tab** — card-based list of saved cars with summary comparison. Click a card to view its full evaluation; select 2–4 cards to open a detailed comparison page.
2. **Compare page** (`compare.html`) — full-width table comparing specs, scores, and per-rule results across up to 4 vehicles.

## Data Model

### `saved` table (IndexedDB via Dexie)

Extends the existing `SavedRow`. Dexie schema version bump required.

```typescript
interface SavedRow {
  carId: string;
  url: string;
  savedAt: number;
  expiresAt: number;           // savedAt + 15 days
  updatedAt: number;           // last update timestamp

  // Spec snapshot — extracted from parsed.raw.base (FieldStatus<EncarCarBase>).
  // Extraction uses isValue() guard; fields are null when base is not 'value' kind.
  title: string;               // car name (from category.modelName + gradeName)
  year: number | null;         // from category.formYear or yearMonth
  mileageKm: number | null;    // from spec.mileage
  priceWon: number | null;     // from advertisement.price
  fuelType: string | null;     // from spec.fuelName

  // Full parsed data — the single source of truth.
  // facts + report are NEVER stored; always recomputed via
  // encarToFacts(parsed) + evaluate(facts) on read.
  parsed: EncarParsedData;
}
```

**Index:** `carId` (primary), `savedAt`, `expiresAt`.

> **Note:** `score`, `verdict`, `killerCount`, `warnCount` are not stored — they are derived from `parsed` at read time via bridge+rules recomputation. This avoids stale snapshots diverging from the latest rule logic.

### Key behaviors

- **Save:** Extract spec fields from `parsed.raw.base` using `isValue()` guard (null when FieldStatus kind is not `'value'`). Set `expiresAt = now + 15 days`.
- **Revisit update:** When `COLLECT_RESULT` fires and the `carId` exists in `saved`, overwrite `parsed` + spec snapshot with fresh data and reset `expiresAt` to `now + 15 days`.
- **Read (list/compare):** Always recompute `facts` + `report` from stored `parsed` via `encarToFacts()` + `evaluate()` (same invariant as cache — latest rule logic always applies). Derived values (`score`, `verdict`, `killerCount`, `warnCount`) are computed per read, never stored.
- **Expiry sweep:** Extend existing `sweep-expired` alarm to also delete `saved` rows where `expiresAt < now`.

### Dexie Migration (v1 → v2)

Current schema is version 1. Bump to version 2 with the new `saved` columns. Existing `saved` rows (if any) lack `parsed`, `expiresAt`, etc. — Dexie's `upgrade()` callback deletes all existing `saved` rows since they cannot be backfilled. This is safe: the feature is new and no users have meaningful saved data yet.

```typescript
this.version(2).stores({
  cache: 'carId, cachedAt, expiresAt',
  acks: '[carId+ruleId], expiresAt',
  saved: 'carId, savedAt, expiresAt',  // added expiresAt index
  settings: 'key',
}).upgrade(tx => tx.table('saved').clear());
```

### TTL

- **15 days** from save (or last revisit).
- Each revisit resets the 15-day timer.

## Messaging Protocol

### New message types

| Type | Direction | Purpose |
|------|-----------|---------|
| `SAVE_CAR` | sidepanel → background | Save current car |
| `UNSAVE_CAR` | sidepanel → background | Remove from saved |
| `GET_SAVED_LIST` | sidepanel/compare → background | Retrieve all saved cars |
| `IS_SAVED` | sidepanel → background | Check if current car is saved |

### Background handler changes

- `SAVE_CAR`: Extract spec fields from `parsed.raw.base` via `isValue()` guard, build `SavedRow`, put into `saved` table.
- `UNSAVE_CAR`: Delete by `carId`.
- `GET_SAVED_LIST`: Read all non-expired rows. For each row, recompute `facts` via `encarToFacts(row.parsed)` and `report` via `evaluate(facts)`. Return enriched array. Performance note: O(N) rule evaluations per call — acceptable for ≤15 saved cars; no debounce needed at this scale.
- `IS_SAVED`: Check existence by `carId`, return boolean.
- **Existing `COLLECT_RESULT` broadcast handler**: After caching, check if `carId` exists in `saved` → if so, update `parsed` + spec snapshot + reset `expiresAt`.

## Side Panel UI

### Tab structure change

Before: `Checklist` | `AI`
After: `Checklist` | `AI` | `My List`

### ActionBar — Save button

Add a save/unsave toggle button to the existing ActionBar:

- **Unsaved state:** Outline bookmark icon + "SAVE" label
- **Saved state:** Filled bookmark icon + "SAVED" label (click to unsave)
- Styled consistent with brutalist theme (black border, uppercase)

On mount, send `IS_SAVED` to determine initial state.

### "My List" tab — Card list

Each saved car renders as a card:

```
┌─────────────────────────────────┐
│ [87] OK          2021 · 3.2만km │
│ 현대 아반떼 1.6 가솔린           │
│ 1,850만원                       │
│ ██████░░ K:0 W:1                │
│                    [삭제] [비교] │
└─────────────────────────────────┘
```

- **Card click** → Switch to Checklist tab and load that car's evaluation from saved `parsed` data. This overrides the active-tab-based data: App holds a `viewingSavedCarId` state that, when set, makes `useCarData` return the saved row's recomputed data instead of the live tab's data. A "back to live" button clears this override.
- **Checkbox click** → Toggle selection for comparison.
- **Delete button** → Send `UNSAVE_CAR`, remove from list.

### Compare entry

- When 2–4 cards are selected, show a floating **"COMPARE N"** button at bottom.
- Click opens `compare.html?ids=carId1,carId2,...` in a new tab.
- Max 4 cars (table readability limit).

### Empty state

"저장된 매물이 없습니다. 차량 페이지에서 SAVE 버튼을 눌러 추가하세요."

## Compare Page (`compare.html`)

### Setup

- Separate entry point: `src/compare/main.tsx` + `compare.html` registered as a regular extension page (NOT `chrome_url_overrides` — that is only for newtab/history/bookmarks).
- Vite config (`vite.config.ts`) needs a new HTML entry point for `compare.html` so `@crxjs/vite-plugin` bundles it.
- Opened via `chrome.runtime.getURL('compare.html?ids=...')` in a new tab.
- React 18, shares existing theme (`theme.ts`), brutalist style.
- The compare page is an extension page context — `chrome.runtime.sendMessage` works the same as in the sidepanel.
- On load: parse `ids` from URL query → send `GET_SAVED_LIST` → filter by ids → recompute facts+report → render.

### Layout — Horizontal table

Rows = items, Columns = cars (max 4).

#### Section 1: Summary

| | Car A | Car B | Car C |
|---|---|---|---|
| Verdict | OK [87] | CAUTION [62] | NEVER [15] |
| Score bar | ████████░░ | ██████░░░░ | ██░░░░░░░░ |

#### Section 2: Specs

| | Car A | Car B | Car C |
|---|---|---|---|
| Price | 1,850만 | 2,100만 | 1,200만 |
| Year | 2021 | 2020 | 2019 |
| Mileage | 3.2만km | 5.8만km | 8.1만km |
| Fuel | 가솔린 | 가솔린 | 디젤 |

#### Section 3: Rules (R01–R11)

| | Car A | Car B | Car C |
|---|---|---|---|
| R01 보험이력 | pass | pass | fail |
| R02 성능점검 | pass | warn | fail |
| ... | | | |
| R11 가격적정성 | pass | pass | warn |

**Difference highlight:** When severity differs across cars in the same row, the row background is tinted to draw attention.

#### Section 4: Actions

- Each column header: car title + "엔카에서 보기" link (opens `url` in new tab) + "목록에서 제거" button.

### Styling

- Archivo Black for headings, Inter Tight for body, Space Mono for data.
- Black borders, fluorescent yellow (#CCFF00) accents for selected/highlighted elements.
- Responsive: 2 cars side-by-side minimum, horizontal scroll for 3–4.

## Files to Create / Modify

### New files

- `src/compare/main.tsx` — Compare page entry point
- `src/compare/App.tsx` — Compare page root component
- `src/compare/components/CompareTable.tsx` — Main comparison table
- `src/compare/components/SummaryRow.tsx` — Verdict + score row
- `src/compare/components/SpecRow.tsx` — Spec comparison row
- `src/compare/components/RuleRow.tsx` — Per-rule comparison row
- `src/sidepanel/components/SaveButton.tsx` — Save/unsave toggle
- `src/sidepanel/components/SavedList.tsx` — "My List" tab content
- `src/sidepanel/components/SavedCard.tsx` — Individual saved car card
- `compare.html` — Compare page HTML shell

### Modified files

- `src/core/storage/db.ts` — Extend `SavedRow`, bump Dexie version, update `sweepExpired`
- `src/core/messaging/protocol.ts` — Add 4 new message types + type guards
- `src/background/index.ts` — Handle new messages + revisit-update logic
- `src/sidepanel/App.tsx` — Add "My List" tab, wire save state
- `src/sidepanel/components/TabBar.tsx` — Add `'mylist'` to `Tab` union, third entry in `TABS` array, update `grid-template-columns: 1fr 1fr` → `1fr 1fr 1fr`
- `src/sidepanel/components/ActionBar.tsx` — Add save button
- `src/manifest.ts` — Register `compare.html` as extension page
- `vite.config.ts` — Add `compare.html` as additional HTML entry point for `@crxjs/vite-plugin`

## Out of Scope

- AI evaluation storage/comparison (future enhancement)
- Price history tracking / price change alerts
- Export / share comparison results
- Encar listing status monitoring (sold, price changed)
