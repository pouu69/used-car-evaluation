# AutoVerdict — Claude Code Guide

Chrome extension (Manifest V3): auto-evaluates used car listings on Encar (fem.encar.com).
12-rule deterministic checklist + optional LLM advisory.

## Architecture Overview

Unidirectional 4-layer pipeline. Each layer consumes only the output of the layer directly below it.

```
COLLECTOR (content scripts + background)
   ↓  raw JSON + httpStatus
PARSER (src/core/parsers/)
   ↓  EncarParsedData (FieldStatus<T>)
BRIDGE (src/core/bridge/)
   ↓  ChecklistFacts (site-agnostic)
RULES (src/core/rules/)
   ↓  RuleReport { verdict, score, results[] }
SIDEPANEL UI (React 18)
```

Detailed design: see [`docs/architectures/`](docs/architectures/00-overview.md).

## Project Layout

```
src/
  manifest.ts            — Chrome extension manifest
  background/            — Service worker: message handling, orchestration
  content/fem-encar/     — MAIN world (API fetch) + ISOLATED world (relay)
  core/
    types/               — FieldStatus, ParsedData, ChecklistFacts, RuleTypes
    parsers/             — Encar JSON/state parsers (pure functions, no I/O)
    bridge/              — EncarParsedData → ChecklistFacts conversion
    collectors/          — Source registry, multi-source merge
    rules/               — R01–R12 rule functions + evaluate()
    evaluation/          — LLM evaluation prompts + execution
    llm/                 — OpenAI/Gemini clients (provider-agnostic interface)
    storage/             — IndexedDB (Dexie) — cache, acks, saved, settings
    messaging/           — Message protocol union type + type guards
    encar/               — URL utilities
    log.ts               — Dev-only logger
  sidepanel/
    App.tsx              — Root: tab/filter state, render branching
    AiEvaluationPanel.tsx — AI tab: API key input + LLM invocation
    components/          — Hero, CarStrip, TabBar, HealthRadar, RuleCard, etc.
    hooks/               — useCarData (central data hook), useCountUp
    lib/                 — verdict, radar, percent, ruleNumber utilities
    theme.ts             — COLORS, FONTS, globalCss
    rule-meta.ts         — Per-rule icon/category/title metadata
tests/                   — Vitest unit/integration tests + fixtures
docs/architectures/      — Per-topic architecture docs (10 files)
```

## Core Invariants

- **`FieldStatus<T>` everywhere** — Missing values are typed by `kind` (value / hidden_by_dealer / parse_failed / loading / timeout), not `undefined`. Rules determine severity based on the reason for absence.
- **Re-run bridge+rules on every read** — IndexedDB cache only trusts `parsed`. `facts` and `report` are recomputed on every read, so rule logic changes take effect immediately without cache invalidation.
- **MAIN world injection for CORS** — `chrome.scripting.executeScript({ world: 'MAIN' })` runs API calls from the Encar domain context. Never set `credentials: 'include'`.
- **API keys in memory only** — Stored only in React state. Never written to IndexedDB, chrome.storage, or localStorage.
- **Personal listing branch** — When `isPersonalListing()` is true, R03 is auto-skipped and R04 falls back to unknown when no frame signal exists.

## Development Principles

- Rule/type/messaging layers can remain untouched during UI redesigns
- Keep files under 200 LOC (especially `src/sidepanel/`)
- Prefer per-component CSS strings + className over inline `style={{...}}`
- No CSS-in-JS libraries (bundle weight)
- Respect `prefers-reduced-motion: reduce`
- Parsers must be pure functions — no I/O, no side effects
- `mainWorldCollect` is stringified at injection time — cannot reference module-scope symbols

## Rules Summary

| Rule | Title | Killer | Bonus-only |
|------|-------|:------:|:----------:|
| R01 | Insurance history disclosure | | |
| R02 | Inspection report disclosure | | |
| R03 | Encar diagnosis | | Y (null if absent) |
| R04 | Frame integrity | Y | |
| R05 | Rental/taxi history | Y | |
| R06 | Total loss/flood/theft | Y | |
| R07 | Owner change count | | |
| R08 | Insurance coverage gap | | |
| R09 | Unconfirmed repair costs | | |
| R10 | Insurance claim amount | | |
| R11 | Price reasonableness | | Y (null if no MSRP) |
| R12 | Oil leak (누유) | | Y (null if no inspection) |

Verdict: killers > 0 → NEVER, warns > 0 → CAUTION, any unknown → UNKNOWN, else → OK.

## Messaging Protocol

```
COLLECT_REQUEST   — content → background (page data collected)
COLLECT_FOR_TAB   — sidepanel → background (direct collection trigger)
COLLECT_PROGRESS  — background → broadcast (progress stage)
COLLECT_RESULT    — background → sidepanel (result)
COLLECT_ERROR     — background → sidepanel (error)
GET_LAST          — sidepanel → background (cache lookup)
REFRESH           — sidepanel → background (cache invalidation)
ACK_RULE          — sidepanel → background (ignore rule for 7 days)
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | tsc typecheck + Vite build → `dist/` |
| `npm run typecheck` | tsc typecheck only |
| `npm test` | Vitest unit/integration tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run package` | Build + package for distribution |

## Active Design Specs

Consult relevant specs before making code changes:

- **[Side Panel UX Redesign — Brutalist Scoreboard (2026-04-09)](docs/superpowers/specs/2026-04-09-sidepanel-brutalist-redesign.md)** — Full sidepanel rewrite with Archivo Black + fluorescent yellow brutalism scoreboard. Data model unchanged, only `src/sidepanel/**` affected.
