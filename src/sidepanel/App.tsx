import React, { useMemo, useState } from 'react';
import type { RuleResult } from '@/core/types/RuleTypes.js';
import { CATEGORY_ORDER, RULE_META, type Category } from './rule-meta.js';
import { AiEvaluationPanel, css as aiPanelCss } from './AiEvaluationPanel.js';
import { globalCss } from './theme.js';
import { useCarData, isEncarDetail } from './hooks/useCarData.js';

import {
  Hero,
  css as heroCss,
} from './components/Hero.js';
import {
  CarStrip,
  css as carStripCss,
} from './components/CarStrip.js';
import {
  TabBar,
  css as tabBarCss,
  type Tab,
} from './components/TabBar.js';
import {
  HealthRadar,
  css as healthRadarCss,
} from './components/HealthRadar.js';
import {
  FilterTabs,
  css as filterTabsCss,
  type Filter,
} from './components/FilterTabs.js';
import {
  RuleGroup,
  css as ruleGroupCss,
} from './components/RuleGroup.js';
import { css as ruleCardCss } from './components/RuleCard.js';
import {
  ActionBar,
  css as actionBarCss,
} from './components/ActionBar.js';
import {
  LoadingView,
  css as loadingCss,
} from './components/LoadingView.js';
import {
  EmptyState,
  css as emptyCss,
} from './components/EmptyState.js';
import {
  ErrorView,
  css as errorCss,
} from './components/ErrorView.js';

/**
 * Brutalist Scoreboard shell.
 *
 * Owns:
 *  - data loading via useCarData
 *  - tab ('checklist' | 'ai')
 *  - filter ('all' | 'fatal' | 'warn' | 'pass' | 'na')
 *
 * Everything else is delegated to focused components. Each component
 * exports its own `css` string; we concatenate them here into a single
 * <style> so no CSS-in-JS library is needed.
 */

const SHEET =
  globalCss +
  heroCss +
  carStripCss +
  tabBarCss +
  healthRadarCss +
  filterTabsCss +
  ruleGroupCss +
  ruleCardCss +
  actionBarCss +
  loadingCss +
  emptyCss +
  errorCss +
  aiPanelCss;

interface Counts {
  total: number;
  killers: number;
  warns: number;
  passes: number;
  unknowns: number;
}

const computeCounts = (results: RuleResult[]): Counts => ({
  total: results.length,
  killers: results.filter((r) => r.severity === 'killer').length,
  warns: results.filter((r) => r.severity === 'warn').length,
  passes: results.filter((r) => r.severity === 'pass').length,
  unknowns: results.filter((r) => r.severity === 'unknown').length,
});

const applyFilter = (results: RuleResult[], filter: Filter): RuleResult[] => {
  if (filter === 'all') return results;
  if (filter === 'fatal')
    return results.filter(
      (r) => r.severity === 'killer' || r.severity === 'fail',
    );
  if (filter === 'warn') return results.filter((r) => r.severity === 'warn');
  if (filter === 'pass') return results.filter((r) => r.severity === 'pass');
  return results.filter((r) => r.severity === 'unknown');
};

const groupByCategory = (
  results: RuleResult[],
): Array<readonly [Category, RuleResult[]]> => {
  const map = new Map<Category, RuleResult[]>();
  for (const r of results) {
    const cat = RULE_META[r.ruleId]?.category ?? '투명성';
    const arr = map.get(cat) ?? [];
    arr.push(r);
    map.set(cat, arr);
  }
  return CATEGORY_ORDER.filter((c) => map.has(c)).map(
    (c) => [c, map.get(c)!] as const,
  );
};

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      minHeight: '100vh',
      background: '#ffffff',
      color: '#000000',
      fontFamily: "'Inter Tight', sans-serif",
    }}
  >
    <style>{SHEET}</style>
    {children}
  </div>
);

export const App: React.FC = () => {
  const { active, row, loading, progressStage, loadError, refresh, ack } =
    useCarData();
  const [tab, setTab] = useState<Tab>('checklist');
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo<Counts>(
    () => (row ? computeCounts(row.report.results) : {
      total: 0,
      killers: 0,
      warns: 0,
      passes: 0,
      unknowns: 0,
    }),
    [row],
  );

  const filtered = useMemo(
    () => (row ? applyFilter(row.report.results, filter) : []),
    [row, filter],
  );

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  // ── Render branches ───────────────────────────────────────────
  if (!active || !isEncarDetail(active.url)) {
    return (
      <Wrapper>
        <EmptyState />
      </Wrapper>
    );
  }

  const stale = !!(row && active.carId && active.carId !== row.carId);

  if (loadError) {
    return (
      <Wrapper>
        <ErrorView reason={loadError} onRetry={refresh} />
      </Wrapper>
    );
  }

  if (loading || progressStage !== null || !row || stale) {
    return (
      <Wrapper>
        <LoadingView
          stage={progressStage}
          carId={active.carId ?? undefined}
          onRefresh={refresh}
        />
      </Wrapper>
    );
  }

  // Cumulative start index so stagger animations continue across groups.
  let cursor = 0;
  const groupsWithIndex = grouped.map(([cat, rules]) => {
    const startIndex = cursor;
    cursor += rules.length;
    return { cat, rules, startIndex };
  });

  return (
    <Wrapper>
      <Hero
        score={row.report.score}
        verdict={row.report.verdict}
        killers={row.report.killers}
        warns={row.report.warns}
      />
      <CarStrip parsed={row.parsed} carId={row.carId} />
      <TabBar tab={tab} onChange={setTab} />

      {tab === 'checklist' && (
        <>
          <HealthRadar results={row.report.results} />
          <FilterTabs
            counts={counts}
            active={filter}
            onChange={setFilter}
          />
          {groupsWithIndex.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                fontFamily: "'Space Mono', monospace",
                fontSize: 10,
                letterSpacing: 2,
                textTransform: 'uppercase',
                borderBottom: '3px solid #000',
              }}
            >
              NOTHING MATCHES FILTER
            </div>
          ) : (
            groupsWithIndex.map(({ cat, rules, startIndex }) => (
              <RuleGroup
                key={cat}
                category={cat}
                rules={rules}
                startIndex={startIndex}
                onAck={ack}
              />
            ))
          )}
          <ActionBar onRefresh={refresh} onGoToAi={() => setTab('ai')} />
        </>
      )}

      {tab === 'ai' && (
        <AiEvaluationPanel
          parsed={row.parsed}
          facts={row.facts}
          report={row.report}
        />
      )}
    </Wrapper>
  );
};
