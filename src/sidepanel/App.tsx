import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import type { Message } from '@/core/messaging/protocol';
import type { CacheRow } from '@/core/storage/db';
import type { EncarParsedData } from '@/core/types/ParsedData';
import type { RuleResult, Severity, Verdict } from '@/core/types/RuleTypes';
import { RULE_META, CATEGORY_ORDER, type Category } from './rule-meta';
import { AiEvaluationPanel } from './AiEvaluationPanel';

interface CarTitle {
  primary: string;
  secondary?: string;
}

const formatYearMonth = (ym: string | undefined): string | undefined => {
  if (!ym || ym.length < 6) return undefined;
  return `${ym.slice(0, 4)}년 ${ym.slice(4, 6)}월`;
};

const formatMileage = (km: number | undefined): string | undefined => {
  if (km === undefined) return undefined;
  return `${km.toLocaleString()}km`;
};

const formatPrice = (man: number | undefined): string | undefined => {
  if (man === undefined || man === 0) return undefined;
  if (man >= 10000) {
    const eok = Math.floor(man / 10000);
    const rest = man % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${man.toLocaleString()}만원`;
};

const buildCarTitle = (parsed: EncarParsedData | undefined): CarTitle | null => {
  if (!parsed) return null;
  const base = parsed.raw.base;
  if (base.kind !== 'value') return null;
  const b = base.value;
  const parts = [b.category.manufacturerName, b.category.modelName]
    .filter(Boolean)
    .join(' ');
  const primary = parts || '매물';
  const subBits = [
    b.category.gradeName,
    b.category.gradeDetailName,
    formatYearMonth(b.category.yearMonth),
    formatMileage(b.spec.mileage),
    formatPrice(b.advertisement.price),
  ].filter((s): s is string => Boolean(s && s.length > 0));
  return {
    primary,
    secondary: subBits.length > 0 ? subBits.join(' · ') : undefined,
  };
};

const VERDICT_STYLE: Record<
  Verdict,
  { bg: string; glow: string; label: string; emoji: string; sub: string }
> = {
  OK: {
    bg: 'linear-gradient(135deg,#1f6f3f,#2d9d5c)',
    glow: 'rgba(45,157,92,0.35)',
    label: '괜찮은 매물',
    emoji: '✅',
    sub: '모든 체크 통과',
  },
  CAUTION: {
    bg: 'linear-gradient(135deg,#a06b00,#d4951a)',
    glow: 'rgba(212,149,26,0.35)',
    label: '주의 필요',
    emoji: '⚠',
    sub: '일부 경고',
  },
  UNKNOWN: {
    bg: 'linear-gradient(135deg,#3a3f47,#555b65)',
    glow: 'rgba(90,96,105,0.35)',
    label: '확인 필요',
    emoji: '❔',
    sub: '데이터 부족',
  },
  NEVER: {
    bg: 'linear-gradient(135deg,#8b1a1a,#c82333)',
    glow: 'rgba(200,35,51,0.4)',
    label: '피해야 할 매물',
    emoji: '🚨',
    sub: '심각한 위험 신호',
  },
};

const SEVERITY_DOT: Record<Severity, { color: string; label: string }> = {
  pass: { color: '#2d9d5c', label: '통과' },
  warn: { color: '#d4951a', label: '주의' },
  fail: { color: '#c82333', label: '실패' },
  killer: { color: '#c82333', label: '심각' },
  unknown: { color: '#6a7380', label: '확인불가' },
};

const STAGE_LABEL: Record<string, string> = {
  start: '평가를 시작합니다...',
  fetching_reports: '이력·진단·사고 리포트 수집 중...',
};

type Filter = 'all' | 'risks' | 'pass' | 'unknown';
type Tab = 'checklist' | 'ai';

const extractCarId = (url: string | undefined): string | null => {
  if (!url) return null;
  const m = /\/cars\/detail\/(\d+)/.exec(url);
  return m?.[1] ?? null;
};

const isEncarDetail = (url: string | undefined): boolean =>
  !!url && /^https:\/\/fem\.encar\.com\/cars\/detail\//.test(url);

interface ActiveTabInfo {
  tabId: number;
  url: string;
  carId: string | null;
}

const queryActiveTab = async (): Promise<ActiveTabInfo | null> => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id || !tab.url) return null;
  return { tabId: tab.id, url: tab.url, carId: extractCarId(tab.url) };
};

const HARD_LOAD_TIMEOUT_MS = 25_000;

/**
 * Ask the background to run its MAIN-world collector against the given tab.
 * Bypasses content-script messaging entirely.
 */
const triggerCollect = async (
  tabId: number,
  carId: string,
  url: string,
): Promise<void> => {
  try {
    await chrome.runtime.sendMessage<Message>({
      type: 'COLLECT_FOR_TAB',
      carId,
      url,
      tabId,
    });
  } catch {
    /* background may be warming up */
  }
};

export const App: React.FC = () => {
  const [active, setActive] = useState<ActiveTabInfo | null>(null);
  const [row, setRow] = useState<CacheRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [tab, setTab] = useState<Tab>('checklist');
  const [loadError, setLoadError] = useState<string | null>(null);
  // Ref mirrors `active` so the message listener can read the latest active tab
  // without being recreated on every state change.
  const activeRef = useRef<ActiveTabInfo | null>(null);
  activeRef.current = active;

  const load = useCallback(async () => {
    const tabInfo = await queryActiveTab();
    setActive(tabInfo);
    if (!tabInfo?.carId) {
      setRow(null);
      setLoading(false);
      return;
    }
    try {
      const resp = (await chrome.runtime.sendMessage<Message>({
        type: 'GET_LAST',
        carId: tabInfo.carId,
      })) as CacheRow | null;
      setRow(resp ?? null);
      if (resp) {
        setProgressStage(null);
        setLoadError(null);
        setLoading(false);
        return;
      }
      // Cache miss. Proactively trigger a background collect via
      // chrome.scripting.executeScript so we don't depend on the content
      // script running at the right moment.
      setProgressStage('start');
      void triggerCollect(tabInfo.tabId, tabInfo.carId, tabInfo.url);
    } catch {
      setRow(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();

    const listener = (msg: unknown) => {
      if (typeof msg !== 'object' || msg === null || !('type' in msg)) return;
      const m = msg as Message;
      if (m.type === 'COLLECT_PROGRESS') {
        setProgressStage(m.stage);
        setLoadError(null);
      } else if (m.type === 'COLLECT_RESULT') {
        setProgressStage(null);
        setLoadError(null);
        // Apply the result directly if it's for the currently active tab.
        // This bypasses the DB round-trip and avoids listener/DB race
        // conditions that otherwise leave the UI stuck in loading.
        const cur = activeRef.current;
        if (cur && cur.carId === m.carId) {
          const now = Date.now();
          setRow({
            carId: m.carId,
            url: cur.url,
            parsed: m.parsed,
            facts: m.facts,
            report: m.report,
            cachedAt: now,
            expiresAt: now + 24 * 60 * 60 * 1000,
          });
          setLoading(false);
        } else {
          // Not for us (user may have switched tabs) — reconcile via DB.
          void load();
        }
      } else if (m.type === 'COLLECT_ERROR') {
        setProgressStage(null);
        // Only flag as error if it's for the currently active tab.
        const cur = activeRef.current;
        if (cur && cur.carId === m.carId) {
          setLoadError(m.reason);
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    const onActivated = () => {
      setLoading(true);
      setProgressStage(null);
      void load();
    };
    chrome.tabs.onActivated.addListener(onActivated);

    const onUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tabObj: chrome.tabs.Tab,
    ) => {
      if (!tabObj.active) return;
      if (changeInfo.url) {
        setRow(null);
        setProgressStage('start');
        setLoading(true);
        void load();
      } else if (changeInfo.status === 'complete') {
        void load();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [load]);

  const refresh = useCallback(async () => {
    const fresh = await queryActiveTab();
    setActive(fresh);
    if (!fresh?.carId) {
      setLoading(false);
      return;
    }

    // Clear every transient state so LoadingView effect deps change.
    setLoadError(null);
    setProgressStage('start');
    setRow(null);
    setLoading(true);

    // Invalidate cache, then trigger fresh executeScript via background.
    await chrome.runtime
      .sendMessage<Message>({ type: 'REFRESH', carId: fresh.carId })
      .catch(() => {});
    void triggerCollect(fresh.tabId, fresh.carId, fresh.url);

    // Safety net: if no result arrives in 22s, surface a watchdog error.
    const hardTimeout = setTimeout(() => {
      setLoadError('watchdog_timeout');
      setProgressStage(null);
    }, 22_000);
    const off = (msg: unknown) => {
      if (
        typeof msg === 'object' &&
        msg !== null &&
        'type' in msg &&
        ((msg as Message).type === 'COLLECT_RESULT' ||
          (msg as Message).type === 'COLLECT_ERROR' ||
          (msg as Message).type === 'COLLECT_PROGRESS')
      ) {
        clearTimeout(hardTimeout);
        chrome.runtime.onMessage.removeListener(off);
      }
    };
    chrome.runtime.onMessage.addListener(off);
  }, []);

  const counts = useMemo(() => {
    if (!row)
      return { killers: 0, warns: 0, passes: 0, unknowns: 0, total: 0 };
    const results = row.report.results;
    return {
      killers: results.filter((r) => r.severity === 'killer').length,
      warns: results.filter((r) => r.severity === 'warn').length,
      passes: results.filter((r) => r.severity === 'pass').length,
      unknowns: results.filter((r) => r.severity === 'unknown').length,
      total: results.length,
    };
  }, [row]);

  const filtered = useMemo(() => {
    if (!row) return [];
    const results = row.report.results;
    if (filter === 'risks')
      return results.filter(
        (r) =>
          r.severity === 'killer' || r.severity === 'warn' || r.severity === 'fail',
      );
    if (filter === 'pass') return results.filter((r) => r.severity === 'pass');
    if (filter === 'unknown')
      return results.filter((r) => r.severity === 'unknown');
    return results;
  }, [row, filter]);

  const grouped = useMemo(() => {
    const map = new Map<Category, RuleResult[]>();
    for (const r of filtered) {
      const cat = RULE_META[r.ruleId]?.category ?? '투명성';
      const arr = map.get(cat) ?? [];
      arr.push(r);
      map.set(cat, arr);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map(
      (c) => [c, map.get(c)!] as const,
    );
  }, [filtered]);

  // ── Render states ───────────────────────────────────────────
  if (!active || !isEncarDetail(active.url)) {
    return (
      <Wrapper>
        <EmptyState />
      </Wrapper>
    );
  }

  const stale = !!(row && active.carId && active.carId !== row.carId);
  const showLoading = loading || progressStage !== null || !row || stale;

  if (showLoading) {
    return (
      <Wrapper>
        <LoadingView
          stage={progressStage}
          carId={active.carId ?? undefined}
          onRefresh={refresh}
          error={loadError}
        />
      </Wrapper>
    );
  }

  const v = VERDICT_STYLE[row!.report.verdict];
  const score = row!.report.score;
  const title = buildCarTitle(row!.parsed);

  const ack = (ruleId: string) => {
    if (!confirm('정말 무시하시겠습니까? 7일 동안 이 체크는 비활성화됩니다.'))
      return;
    chrome.runtime
      .sendMessage<Message>({ type: 'ACK_RULE', carId: row!.carId, ruleId })
      .then(() => void load())
      .catch(() => {});
  };

  return (
    <Wrapper>
      {/* Verdict hero */}
      <div
        style={{
          background: v.bg,
          borderRadius: 14,
          padding: 18,
          boxShadow: `0 8px 24px -8px ${v.glow}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                opacity: 0.75,
                letterSpacing: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{v.emoji}</span>
              <span>{v.label}</span>
              <span style={{ opacity: 0.5 }}>· {v.sub}</span>
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                lineHeight: 1.25,
                marginTop: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title?.primary ?? `매물 ${row!.carId}`}
            </div>
            {title?.secondary && (
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.85,
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title.secondary}
              </div>
            )}
            <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4 }}>
              #{row!.carId}
            </div>
          </div>
          <ScoreRing score={score} />
        </div>

        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 14,
            flexWrap: 'wrap',
          }}
        >
          <MiniStat color="#ffb3b3" label="심각" value={counts.killers} />
          <MiniStat color="#ffd680" label="주의" value={counts.warns} />
          <MiniStat color="#b5e9c5" label="통과" value={counts.passes} />
          <MiniStat color="#c8ccd1" label="불명" value={counts.unknowns} />
          <button
            onClick={refresh}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 20,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ↻ 재평가
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <TabBar tab={tab} onChange={setTab} />

      {tab === 'checklist' && (
        <>
          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <FilterChip
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              label={`전체 ${counts.total}`}
            />
            <FilterChip
              active={filter === 'risks'}
              onClick={() => setFilter('risks')}
              label={`위험 ${counts.killers + counts.warns}`}
              color="#c82333"
            />
            <FilterChip
              active={filter === 'pass'}
              onClick={() => setFilter('pass')}
              label={`통과 ${counts.passes}`}
              color="#2d9d5c"
            />
            <FilterChip
              active={filter === 'unknown'}
              onClick={() => setFilter('unknown')}
              label={`불명 ${counts.unknowns}`}
              color="#6a7380"
            />
          </div>

          {/* Rule list grouped by category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {grouped.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              opacity: 0.6,
              background: '#161b22',
              borderRadius: 10,
            }}
          >
            해당하는 항목이 없습니다
          </div>
        )}
            {grouped.map(([cat, items]) => (
              <section key={cat}>
                <h3
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    opacity: 0.55,
                    margin: '0 0 8px 4px',
                    fontWeight: 700,
                  }}
                >
                  {cat}
                </h3>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  {items.map((r) => (
                    <RuleCard
                      key={r.ruleId}
                      result={r}
                      onAck={() => ack(r.ruleId)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {tab === 'ai' && (
        /* AI evaluation — gated on user-provided API key, nothing persisted. */
        <AiEvaluationPanel
          parsed={row!.parsed}
          facts={row!.facts}
          report={row!.report}
        />
      )}
    </Wrapper>
  );
};

// ── Subcomponents ────────────────────────────────────────────────

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: 16,
      minHeight: '100vh',
      background: '#0b0d10',
      color: '#e6edf3',
    }}
  >
    <style>{globalCss}</style>
    {children}
  </div>
);

const globalCss = `
  @keyframes daksin-spin { to { transform: rotate(360deg); } }
  @keyframes daksin-pulse { 0%,100% { opacity: 0.55 } 50% { opacity: 1 } }
  * { box-sizing: border-box; }
  body { margin: 0; }
  button:hover { filter: brightness(1.1); }
  summary { cursor: pointer; }
`;

const EmptyState: React.FC = () => (
  <div style={{ padding: 8 }}>
    <h2 style={{ marginTop: 0, fontWeight: 800, fontSize: 22 }}>daksin-car</h2>
    <p style={{ opacity: 0.75, lineHeight: 1.6 }}>
      엔카 매물 페이지 (<code>fem.encar.com/cars/detail/...</code>) 를 열면
      자동으로 평가가 시작됩니다.
    </p>
    <p style={{ opacity: 0.55, fontSize: 13 }}>
      팁: 보험이력·소유자 변경 같은 정보는 엔카 로그인이 필요합니다.
    </p>
  </div>
);

const LoadingView: React.FC<{
  stage: string | null;
  carId?: string;
  onRefresh: () => void;
  error?: string | null;
}> = ({ stage, carId, onRefresh, error }) => {
  // Auto-show "stuck" UI after 25s of NO progress updates (stage stays the same).
  // A stage change resets the timer.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    setStuck(false);
    const t = setTimeout(() => setStuck(true), HARD_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [stage, carId, error]);

  const isError = !!error;
  const isStuck = stuck && !isError;

  return (
    <div
      style={{
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        background: '#161b22',
        borderRadius: 12,
        marginTop: 32,
      }}
    >
      {!isError && !isStuck && (
        <div
          style={{
            width: 42,
            height: 42,
            border: '3px solid #2a3138',
            borderTopColor: '#6aa1ff',
            borderRadius: '50%',
            animation: 'daksin-spin 0.9s linear infinite',
          }}
        />
      )}
      {(isError || isStuck) && (
        <div style={{ fontSize: 36 }}>{isError ? '⚠' : '🕐'}</div>
      )}
      <div style={{ fontSize: 17, fontWeight: 700 }}>
        {isError
          ? '수집에 실패했어요'
          : isStuck
            ? '응답이 늦어지고 있어요'
            : '평가 중...'}
      </div>
      <div
        style={{
          fontSize: 13,
          opacity: 0.75,
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 1.5,
          animation:
            !isError && !isStuck
              ? 'daksin-pulse 1.6s ease-in-out infinite'
              : undefined,
        }}
      >
        {isError
          ? error === 'watchdog_timeout'
            ? '엔카 응답이 18초 내에 오지 않았어요. 잠시 후 다시 시도해 주세요.'
            : error
          : isStuck
            ? '엔카 응답이 느리거나 페이지가 아직 로드 중일 수 있어요.'
            : stage
              ? (STAGE_LABEL[stage] ?? stage)
              : '데이터 수집 준비 중'}
      </div>
      {carId && (
        <div style={{ fontSize: 11, opacity: 0.4 }}>carId · {carId}</div>
      )}
      <button
        onClick={onRefresh}
        style={{
          marginTop: 6,
          background: isError || isStuck ? '#6aa1ff' : '#2a3138',
          color: isError || isStuck ? '#0b0d10' : '#e6edf3',
          border: `1px solid ${isError || isStuck ? '#6aa1ff' : '#3a424c'}`,
          padding: '8px 18px',
          borderRadius: 20,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {isError || isStuck ? '↻ 다시 시도' : '↻ 수동 재수집'}
      </button>
    </div>
  );
};

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      <svg width={72} height={72}>
        <circle
          cx={36}
          cy={36}
          r={r}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={6}
          fill="none"
        />
        <circle
          cx={36}
          cy={36}
          r={r}
          stroke="#fff"
          strokeWidth={6}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
        }}
      >
        <div style={{ fontSize: 20, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 9, opacity: 0.7 }}>/100</div>
      </div>
    </div>
  );
};

const MiniStat: React.FC<{
  label: string;
  value: number;
  color: string;
}> = ({ label, value, color }) => (
  <div
    style={{
      background: 'rgba(0,0,0,0.25)',
      borderRadius: 20,
      padding: '4px 10px',
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}
  >
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
      }}
    />
    <span style={{ opacity: 0.9 }}>
      {label} <b>{value}</b>
    </span>
  </div>
);

const TabBar: React.FC<{
  tab: Tab;
  onChange: (t: Tab) => void;
}> = ({ tab, onChange }) => {
  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'checklist', label: '체크리스트', icon: '📋' },
    { id: 'ai', label: 'AI 평가', icon: '🤖' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        background: '#161b22',
        border: '1px solid #20262e',
        borderRadius: 10,
        padding: 4,
      }}
    >
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              background: active ? '#6aa1ff' : 'transparent',
              color: active ? '#0b0d10' : '#b3bac3',
              border: 'none',
              padding: '8px 10px',
              borderRadius: 7,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'background 0.15s',
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const FilterChip: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}> = ({ active, onClick, label, color }) => (
  <button
    onClick={onClick}
    style={{
      background: active ? (color ?? '#3a424c') : 'transparent',
      color: active ? '#fff' : '#b3bac3',
      border: `1px solid ${active ? (color ?? '#3a424c') : '#2a3138'}`,
      padding: '6px 12px',
      borderRadius: 20,
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 600,
    }}
  >
    {label}
  </button>
);

const RuleCard: React.FC<{
  result: RuleResult;
  onAck?: () => void;
}> = ({ result, onAck }) => {
  const meta = RULE_META[result.ruleId];
  const dot = SEVERITY_DOT[result.severity];
  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #20262e',
        borderLeft: `3px solid ${dot.color}`,
        padding: '10px 12px',
        borderRadius: 8,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          fontSize: 22,
          lineHeight: 1,
          width: 28,
          textAlign: 'center',
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        {meta?.icon ?? '•'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <span>{meta?.shortTitle ?? result.title}</span>
          <span
            style={{
              fontSize: 10,
              background: dot.color,
              color: '#fff',
              padding: '1px 7px',
              borderRadius: 10,
              fontWeight: 700,
              letterSpacing: 0.3,
            }}
          >
            {dot.label}
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            opacity: 0.8,
            marginTop: 3,
            lineHeight: 1.5,
          }}
        >
          {result.message}
        </div>
        {onAck && result.acknowledgeable && result.severity === 'killer' && (
          <button
            onClick={onAck}
            style={{
              marginTop: 8,
              background: 'transparent',
              color: '#e6edf3',
              border: '1px solid #3a424c',
              padding: '4px 10px',
              borderRadius: 14,
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            이 경고 인정 (7일)
          </button>
        )}
      </div>
    </div>
  );
};
