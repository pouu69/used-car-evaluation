# Sidepanel Brutalist Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `src/sidepanel/**` as a Brutalist Scoreboard UI per spec `docs/superpowers/specs/2026-04-09-sidepanel-brutalist-redesign.md`. Data layer and messaging unchanged.

**Architecture:** Decompose the 957-LOC `App.tsx` monolith into a thin shell + `hooks/` + `components/` + `theme.ts`. CSS-in-JS library not introduced — each component owns a local `css` string, injected once at App root. TDD applied to pure calc/hook logic; visual components validated manually.

**Tech Stack:** React 18, TypeScript, Vitest, Chrome extension sidepanel APIs, Google Fonts (Archivo Black, Space Mono, Inter Tight).

---

## File Structure

### Create
- `src/sidepanel/theme.ts` — COLORS, FONTS, globalCss with Google Fonts import
- `src/sidepanel/hooks/useCarData.ts` — chrome.runtime messaging, load/refresh/ack
- `src/sidepanel/hooks/useCountUp.ts` — requestAnimationFrame count-up
- `src/sidepanel/lib/verdict.ts` — verdict → label + summary helpers
- `src/sidepanel/lib/radar.ts` — category axis computation (pure)
- `src/sidepanel/lib/ruleNumber.ts` — `R06` → `06` parser
- `src/sidepanel/components/Hero.tsx`
- `src/sidepanel/components/CarStrip.tsx`
- `src/sidepanel/components/TabBar.tsx`
- `src/sidepanel/components/HealthRadar.tsx`
- `src/sidepanel/components/FilterTabs.tsx`
- `src/sidepanel/components/RuleCard.tsx`
- `src/sidepanel/components/RuleGroup.tsx`
- `src/sidepanel/components/ActionBar.tsx`
- `src/sidepanel/components/LoadingView.tsx`
- `src/sidepanel/components/EmptyState.tsx`
- `src/sidepanel/components/ErrorView.tsx`
- `tests/sidepanel/verdict.test.ts`
- `tests/sidepanel/radar.test.ts`
- `tests/sidepanel/ruleNumber.test.ts`

### Modify
- `src/sidepanel/App.tsx` — complete rewrite (~150 LOC, shell only)

### Untouched
- `src/sidepanel/main.tsx`, `index.html`, `rule-meta.ts`, `AiEvaluationPanel.tsx`
- Everything under `src/core/**`, `src/background/**`, `src/content/**`

---

## Task 1: Foundation — theme.ts

**Files:**
- Create: `src/sidepanel/theme.ts`

- [ ] **Step 1.1:** Create `theme.ts` exporting `COLORS`, `FONTS`, and `GOOGLE_FONTS_IMPORT` constants, plus a `globalCss` string containing `@import`, `* { box-sizing }`, `body { margin: 0 }`, keyframes for `daksin-countup`, `daksin-radar-draw`, `daksin-stagger-in`, `daksin-fade`, and a `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }` block.

- [ ] **Step 1.2:** Commit `chore(sidepanel): add theme constants and globalCss`.

## Task 2: lib/verdict.ts + test (TDD)

**Files:**
- Create: `src/sidepanel/lib/verdict.ts`
- Create: `tests/sidepanel/verdict.test.ts`

- [ ] **Step 2.1:** Write failing test `verdict.test.ts` covering:
  - `mapVerdictLabel('NEVER')` → `'DO NOT\nBUY.'`
  - `mapVerdictLabel('CAUTION')` → `'CAUTION.\nREAD ME.'`
  - `mapVerdictLabel('OK')` → `'GOOD.'`
  - `mapVerdictLabel('UNKNOWN')` → `'CHECK\nTHIS.'`
  - `buildVerdictSummary([], [])` → `'특이사항 없음'`
  - `buildVerdictSummary([{title:'전손이력'}], [{title:'수리비 과다'}])` → `'전손이력 · 수리비 과다'` (killer first, then warn, max 3 items joined by ` · `)

- [ ] **Step 2.2:** Run test, verify fail.

- [ ] **Step 2.3:** Implement `verdict.ts` with `mapVerdictLabel(v: Verdict): string` and `buildVerdictSummary(killers: RuleResult[], warns: RuleResult[]): string`.

- [ ] **Step 2.4:** Run test, verify pass.

- [ ] **Step 2.5:** Commit `feat(sidepanel): verdict label and summary helpers`.

## Task 3: lib/ruleNumber.ts + test (TDD)

**Files:**
- Create: `src/sidepanel/lib/ruleNumber.ts`
- Create: `tests/sidepanel/ruleNumber.test.ts`

- [ ] **Step 3.1:** Write failing test covering `ruleNumber('R01')` → `'01'`, `ruleNumber('R11')` → `'11'`, `ruleNumber('X99')` → `'99'`, `ruleNumber('weird')` → `'??'`.

- [ ] **Step 3.2:** Run, verify fail.

- [ ] **Step 3.3:** Implement: match `\d+` then pad to 2 digits, else `'??'`.

- [ ] **Step 3.4:** Run, verify pass.

- [ ] **Step 3.5:** Commit `feat(sidepanel): ruleNumber helper`.

## Task 4: lib/radar.ts + test (TDD)

**Files:**
- Create: `src/sidepanel/lib/radar.ts`
- Create: `tests/sidepanel/radar.test.ts`

- [ ] **Step 4.1:** Write failing test for `computeRadarAxes(results: RuleResult[]): Array<{ category: Category; pass: number; total: number; pct: number }>`:
  - Empty → array of 5 categories with `pct: 0, total: 0, pass: 0`
  - 3 results in 이력: 1 pass, 1 warn, 1 killer → `이력` entry `{ pass: 1, total: 3, pct: 33 }` (rounded)
  - Order matches `CATEGORY_ORDER`

- [ ] **Step 4.2:** Run, verify fail.

- [ ] **Step 4.3:** Implement using `CATEGORY_ORDER` and `RULE_META[id].category`. Treat `unknown` as neither pass nor fail but counted in total. Use `Math.round`.

- [ ] **Step 4.4:** Run, verify pass.

- [ ] **Step 4.5:** Commit `feat(sidepanel): radar axis computation`.

## Task 5: hooks/useCountUp.ts

**Files:**
- Create: `src/sidepanel/hooks/useCountUp.ts`

- [ ] **Step 5.1:** Implement `useCountUp(target: number, durationMs = 600): number` using `useEffect` + `requestAnimationFrame`, ease-out cubic-bezier approximation via `1 - Math.pow(1 - t, 3)`. Respect `prefers-reduced-motion` (return target immediately).

- [ ] **Step 5.2:** Commit `feat(sidepanel): useCountUp hook`.

## Task 6: hooks/useCarData.ts — extract messaging from App.tsx

**Files:**
- Create: `src/sidepanel/hooks/useCarData.ts`

- [ ] **Step 6.1:** Move from `App.tsx` lines 106-308 (`queryActiveTab`, `triggerCollect`, `load`, `refresh`, `useEffect` listener wiring, `activeRef`) into `useCarData()`. Return `{ active, row, loading, progressStage, loadError, refresh, ack }`. `ack` wraps `ACK_RULE` + `load()` re-call, and includes the `confirm()` dialog (moved from App).

- [ ] **Step 6.2:** Commit `refactor(sidepanel): extract useCarData hook`. (App.tsx still compiles because hook is not consumed yet — add minimal no-op so nothing breaks.)

## Task 7: LoadingView, EmptyState, ErrorView

**Files:**
- Create: `src/sidepanel/components/LoadingView.tsx`
- Create: `src/sidepanel/components/EmptyState.tsx`
- Create: `src/sidepanel/components/ErrorView.tsx`

- [ ] **Step 7.1:** Write `LoadingView` — 4px black-bordered box, centered `LOADING` in Archivo Black 64px, stage subtitle in Space Mono 9px. Includes carId footer and `[↻ MANUAL REFETCH]` button. No spinner.

- [ ] **Step 7.2:** Write `EmptyState` — `NOT A CAR` 64px + instructions subtitle (엔카 URL).

- [ ] **Step 7.3:** Write `ErrorView` — `ERROR` 64px + reason text + retry button.

- [ ] **Step 7.4:** Each file owns its local `export const css = \`...\`` string.

- [ ] **Step 7.5:** Commit `feat(sidepanel): brutalist Loading/Empty/Error views`.

## Task 8: CarStrip.tsx

**Files:**
- Create: `src/sidepanel/components/CarStrip.tsx`

- [ ] **Step 8.1:** Component takes `{ parsed: EncarParsedData; carId: string }` props, extracts make/spec/price strings (reuse `formatYearMonth`, `formatMileage`, `formatPrice` — inline them here, delete from App.tsx later), renders 3 lines per spec §3.3.

- [ ] **Step 8.2:** Commit `feat(sidepanel): CarStrip component`.

## Task 9: Hero.tsx

**Files:**
- Create: `src/sidepanel/components/Hero.tsx`

- [ ] **Step 9.1:** Props: `{ score: number; verdict: Verdict; killers: RuleResult[]; warns: RuleResult[] }`. Uses `useCountUp(score)` for animated number, `mapVerdictLabel(verdict)` for label, `buildVerdictSummary(killers, warns)` for one-liner. Renders Hero grid per spec §3.2. Red dot shown only when `killers.length > 0`.

- [ ] **Step 9.2:** Commit `feat(sidepanel): Hero component`.

## Task 10: TabBar.tsx (brutalist)

**Files:**
- Create: `src/sidepanel/components/TabBar.tsx`

- [ ] **Step 10.1:** Replace inner TabBar component from old App.tsx. Two tabs: `CHECKLIST` / `AI REVIEW`, each with Archivo Black 15px main label + Space Mono 8px sub. Active = black bg, white fg. 4px black borders per spec §3.4.

- [ ] **Step 10.2:** Commit `feat(sidepanel): brutalist TabBar`.

## Task 11: HealthRadar.tsx

**Files:**
- Create: `src/sidepanel/components/HealthRadar.tsx`

- [ ] **Step 11.1:** Uses `computeRadarAxes(results)`. SVG viewBox `0 0 360 300`. Compute pentagon vertices for each axis at 4 radii (0%, 33%, 66%, 100%) for grid, plus data polygon at actual pct. Labels use Archivo Black 11px; axes with pct<50 get fill `#ff2d4b`. Data polygon: fill `#e4ff00`, stroke `#000` 3px. Animation: CSS `stroke-dasharray` draw-in per §4 motion ②.

- [ ] **Step 11.2:** Commit `feat(sidepanel): HealthRadar component`.

## Task 12: FilterTabs.tsx

**Files:**
- Create: `src/sidepanel/components/FilterTabs.tsx`

- [ ] **Step 12.1:** Props: `{ counts: { total, killers, warns, passes, unknowns }; active: Filter; onChange: (f: Filter) => void }`. Renders 5-column grid per §3.6. `Filter` type: `'all' | 'fatal' | 'warn' | 'pass' | 'na'`. Active indicator: `::before` 5px top bar.

- [ ] **Step 12.2:** Commit `feat(sidepanel): FilterTabs stat-counter`.

## Task 13: RuleCard.tsx

**Files:**
- Create: `src/sidepanel/components/RuleCard.tsx`

- [ ] **Step 13.1:** Props: `{ result: RuleResult; index: number; onAck?: () => void }`. Derives num via `ruleNumber(result.ruleId)`, title via `RULE_META[result.ruleId]?.shortTitle ?? result.title`, mark/tags/bg via severity per §3.8. Stagger animation via `style={{ animationDelay: \`${index * 50}ms\` }}`.

- [ ] **Step 13.2:** Commit `feat(sidepanel): RuleCard with severity theming`.

## Task 14: RuleGroup.tsx

**Files:**
- Create: `src/sidepanel/components/RuleGroup.tsx`

- [ ] **Step 14.1:** Props: `{ category: Category; rules: RuleResult[]; startIndex: number; onAck: (ruleId: string) => void }`. Renders black-bar header with `category` + pass/total count, then maps `RuleCard` children, passing `index = startIndex + i` for global stagger.

- [ ] **Step 14.2:** Commit `feat(sidepanel): RuleGroup container`.

## Task 15: ActionBar.tsx

**Files:**
- Create: `src/sidepanel/components/ActionBar.tsx`

- [ ] **Step 15.1:** Props: `{ onRefresh: () => void; onGoToAi: () => void }`. 2-column grid per §3.9.

- [ ] **Step 15.2:** Commit `feat(sidepanel): ActionBar`.

## Task 16: App.tsx rewrite

**Files:**
- Modify: `src/sidepanel/App.tsx` (full rewrite)

- [ ] **Step 16.1:** Delete current App.tsx body. Import `useCarData`, all components, `theme.globalCss` + each component's `css`, concatenate into a single `<style>` injected once. Render shell:

```tsx
export const App: React.FC = () => {
  const { active, row, loading, progressStage, loadError, refresh, ack } = useCarData();
  const [tab, setTab] = useState<Tab>('checklist');
  const [filter, setFilter] = useState<Filter>('all');

  if (!active || !isEncarDetail(active.url)) return <Wrapper><EmptyState /></Wrapper>;
  if (loading || progressStage || !row) return <Wrapper><LoadingView stage={progressStage} carId={active.carId ?? undefined} onRefresh={refresh} /></Wrapper>;
  if (loadError) return <Wrapper><ErrorView reason={loadError} onRetry={refresh} /></Wrapper>;

  const counts = computeCounts(row.report.results);
  const filtered = applyFilter(row.report.results, filter);
  const grouped = groupByCategory(filtered);

  return (
    <Wrapper>
      <Hero score={row.report.score} verdict={row.report.verdict} killers={row.report.killers} warns={row.report.warns} />
      <CarStrip parsed={row.parsed} carId={row.carId} />
      <TabBar tab={tab} onChange={setTab} />
      {tab === 'checklist' && <>
        <HealthRadar results={row.report.results} />
        <FilterTabs counts={counts} active={filter} onChange={setFilter} />
        {grouped.map(([cat, rules], gi) => (
          <RuleGroup key={cat} category={cat} rules={rules} startIndex={grouped.slice(0, gi).reduce((n, [, rs]) => n + rs.length, 0)} onAck={ack} />
        ))}
        <ActionBar onRefresh={refresh} onGoToAi={() => setTab('ai')} />
      </>}
      {tab === 'ai' && <AiEvaluationPanel parsed={row.parsed} facts={row.facts} report={row.report} />}
    </Wrapper>
  );
};
```

- [ ] **Step 16.2:** Define `Wrapper` that injects the global stylesheet (`theme.globalCss + Hero.css + CarStrip.css + ...`).

- [ ] **Step 16.3:** Run `npm run typecheck`. Fix all type errors.

- [ ] **Step 16.4:** Run `npm test`. Verify passing.

- [ ] **Step 16.5:** Commit `feat(sidepanel): brutalist scoreboard App shell`.

## Task 17: Verification

- [ ] **Step 17.1:** `npm run typecheck` — PASS.
- [ ] **Step 17.2:** `npm test` — PASS.
- [ ] **Step 17.3:** `npm run build` — PASS.
- [ ] **Step 17.4:** Run through spec §10 manual checklist.
- [ ] **Step 17.5:** Commit `chore(sidepanel): verify build + tests`.

---

## Notes

- Each component file < 200 LOC per CLAUDE.md directive.
- No CSS-in-JS lib. Each file exports `css` string; App.tsx concatenates into a single `<style>`.
- TDD only for pure logic (verdict, radar, ruleNumber). Visual components validated via typecheck + build + manual spec §10.
- Keep `rule-meta.ts` and `AiEvaluationPanel.tsx` untouched.
