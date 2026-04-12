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

  // Spec snapshot (for card/table display)
  title: string;               // car name
  year: number | null;         // model year
  mileageKm: number | null;    // mileage in km
  priceWon: number | null;     // price in KRW
  fuelType: string | null;     // fuel type

  // Evaluation snapshot
  parsed: EncarParsedData;     // full parsed data
  score: number;               // evaluation score (0–100)
  verdict: Verdict;            // OK / CAUTION / NEVER / UNKNOWN
  killerCount: number;         // number of killer-severity results
  warnCount: number;           // number of warn-severity results
}
```

**Index:** `carId` (primary), `savedAt`, `expiresAt`.

### Key behaviors

- **Save:** Build `SavedRow` from current `parsed` + bridge+rules recomputation. Set `expiresAt = now + 15 days`.
- **Revisit update:** When `COLLECT_RESULT` fires and the `carId` exists in `saved`, overwrite the snapshot with fresh data and reset `expiresAt` to `now + 15 days`.
- **Comparison read:** Always recompute `facts` + `report` from stored `parsed` (same invariant as cache — latest rule logic always applies).
- **Expiry sweep:** Extend existing `sweep-expired` alarm to also delete `saved` rows where `expiresAt < now`.

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

- `SAVE_CAR`: Extract specs from `parsed`, compute score/verdict, put into `saved` table.
- `UNSAVE_CAR`: Delete by `carId`.
- `GET_SAVED_LIST`: Read all non-expired rows, recompute `facts` + `report` from `parsed` for each, return array.
- `IS_SAVED`: Check existence by `carId`, return boolean.
- **Existing `COLLECT_RESULT` broadcast handler**: After caching, check if `carId` exists in `saved` → if so, update snapshot + reset `expiresAt`.

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

- **Card click** → Switch to Checklist tab and load that car's evaluation from saved `parsed` data.
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

- Separate entry point: `src/compare/main.tsx` + `compare.html` in extension manifest `chrome_url_overrides` or as a regular extension page.
- React 18, shares existing theme (`theme.ts`), brutalist style.
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
- `src/sidepanel/components/TabBar.tsx` — Add third tab
- `src/sidepanel/components/ActionBar.tsx` — Add save button
- `src/manifest.ts` — Register `compare.html` as extension page

## Out of Scope

- AI evaluation storage/comparison (future enhancement)
- Price history tracking / price change alerts
- Export / share comparison results
- Encar listing status monitoring (sold, price changed)
