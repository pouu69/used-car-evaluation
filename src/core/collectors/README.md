# `src/core/collectors/`

Multi-source merge layer for the 4-layer pipeline.

```
┌────────────────────────────────────────────────┐
│ Collectors (WHERE + HOW to fetch)              │
│  - main_world_fetch → api.encar.com JSON       │  ← background/main-world-collector.ts
│  - page_state       → __PRELOADED_STATE__      │  ← content/fem-encar/main-world.ts
│  - page_dom         → innerText fallback       │  ← reserved (unused today)
│  - injected_script  → fetch/XHR interceptor    │  ← reserved (future)
│  - background_fetch → car.encar.com/history    │  ← reserved (legacy)
└──────────────────────┬─────────────────────────┘
                       ▼
┌────────────────────────────────────────────────┐
│ Parsers (HOW to interpret a payload)            │
│  parsers/encar/state.ts                         │
│  parsers/encar/api-record.ts                    │
│  parsers/encar/api-diagnosis.ts                 │
│  parsers/encar/api-inspection.ts                │
│  → each returns FieldStatus<T>                  │
└──────────────────────┬─────────────────────────┘
                       ▼
┌────────────────────────────────────────────────┐
│ collectors/merge.ts ← this layer                │
│  mergeFieldStatus([{source,status}, …])         │
│   - picks highest priority successful source    │
│   - detects conflicts → warnings                │
│   - propagates loading / all-failed             │
└──────────────────────┬─────────────────────────┘
                       ▼
┌────────────────────────────────────────────────┐
│ bridge/encar-to-facts.ts                        │
│  → ChecklistFacts (site-agnostic)               │
└─────────────────────────────────────────────────┘
```

## Files

- **`sources.ts`** — `SourceId` union + `SOURCE_REGISTRY` metadata
  (priority, acquisition mode, login requirement). **Append-only**: never
  rename an existing `SourceId` because the value appears in persisted
  `bridgeWarnings` and IndexedDB cache rows.

- **`merge.ts`** — `mergeFieldStatus` primitive: combines N candidate
  statuses into one, preferring higher-priority sources, emitting
  `merge_conflict:A≠B` warnings when two successful sources disagree.

## When to use merge

Today the bridge reads each `FieldStatus<T>` from a single source (R01–R03
from `detailFlags`, R05–R10 from `recordApi`, etc.). Merge becomes valuable
when two sources can answer the **same** question:

| Field              | Sources that could answer                          |
|--------------------|----------------------------------------------------|
| R06 totalLoss      | `recordApi.totalLossCnt` + `inspectionApi.master.detail.waterlog` |
| R04 frameDamage    | `diagnosisApi.items` + `inspectionApi.outers[].statusTypes` |
| mileage            | `preloaded.base.spec.mileage` + `inspectionApi.master.detail.mileage` |
| R12 recall         | `inspectionApi.master.detail.recall` + history `uiData.item.caution.recall` |

Calling sites should:

```ts
import { mergeFieldStatus } from '@/core/collectors/merge';
import type { MergeCandidate } from '@/core/collectors/merge';

const candidates: MergeCandidate<boolean>[] = [
  { source: 'inspection_api', status: inspectWaterlogStatus },
  { source: 'record_api',     status: recordTotalLossStatus },
];
const { status, chosenSource, warnings } = mergeFieldStatus(candidates);
facts.totalLossHistory = status;
facts.bridgeWarnings.push(...warnings);
```

## Source priorities (higher wins)

| SourceId             | Priority | Why                                  |
|----------------------|---------:|--------------------------------------|
| `manual`             |     1000 | User override beats everything       |
| `preloaded_state`    |      100 | 1st-party page state, hydration-safe |
| `record_api`         |       95 | Structured JSON, no heuristics       |
| `diagnosis_api`      |       95 | Structured JSON, no heuristics       |
| `inspection_api`     |       95 | Structured JSON, no heuristics       |
| `history_ui_data`    |       80 | Requires login, legacy shape         |
| `next_data`          |       70 | Fallback when preloaded missing      |
| `fetch_interceptor`  |       60 | Experimental, brittle timing         |
| `main_dom`           |       30 | Pure DOM heuristics                  |

## Invariants

- **I1**: Never rename an existing `SourceId` — serialized into caches.
- **I2**: `mergeFieldStatus([])` returns `parse_failed('no_sources')`.
- **I3**: Warnings are additive (never silent) — callers must propagate them
  to `ChecklistFacts.bridgeWarnings` for UI surfacing.
- **I4**: Merge is **pure** — no `window`/`fetch`/`chrome.*`. Collectors
  themselves stay in `src/background/*` and `src/content/*`.
