/**
 * AI 평가 패널 — Brutalist Scoreboard edition.
 *
 * - API key는 **메모리(React state)에만** 저장한다. localStorage/IndexedDB/
 *   chrome.storage 어디에도 넣지 않는다. 사이드패널이 닫히거나 새로고침되면
 *   다시 입력해야 한다 — 이게 의도된 동작.
 * - API key가 비어 있으면 평가 버튼이 disabled. runCarEvaluation도
 *   자체적으로 null을 반환하지만 UI 레벨에서 미리 차단.
 */
import React, { useCallback, useRef, useState } from 'react';
import type { EncarParsedData } from '@/core/types/ParsedData';
import type { ChecklistFacts } from '@/core/types/ChecklistFacts';
import type { RuleReport } from '@/core/types/RuleTypes';
import {
  canRunEvaluation,
  runCarEvaluation,
  type CarEvaluation,
  type EvaluationFinding,
  type EvaluationRiskLevel,
  type EvaluationVerdict,
} from '@/core/evaluation';
import { LLMError, type LLMProvider } from '@/core/llm';

interface AiEvaluationPanelProps {
  parsed: EncarParsedData;
  facts: ChecklistFacts;
  report: RuleReport;
}

export const css: string = `
.ai-root {
  background: #fff;
  color: #000;
  border-bottom: 4px solid #000;
  animation: autoverdict-fade 260ms ease-out both;
}

.ai-header {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #000;
  color: #fff;
  padding: 10px 14px;
  border-bottom: 4px solid #000;
}
.ai-header-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  letter-spacing: -0.2px;
  text-transform: uppercase;
}
.ai-header-note {
  margin-left: auto;
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 2px;
  text-transform: uppercase;
  opacity: 0.7;
}

.ai-section {
  padding: 12px 14px;
  border-bottom: 2px solid #000;
}

.ai-provider {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border: 2px solid #000;
}
.ai-provider-btn {
  background: #fff;
  color: #000;
  border: none;
  border-right: 2px solid #000;
  padding: 10px 8px;
  cursor: pointer;
  font-family: 'Archivo Black', sans-serif;
  font-size: 11px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  text-align: left;
}
.ai-provider-btn:last-child { border-right: none; }
.ai-provider-btn--active {
  background: #000;
  color: #fff;
}
.ai-provider-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.ai-provider-sub {
  display: block;
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 1px;
  margin-top: 3px;
  opacity: 0.65;
}

.ai-key-row {
  display: flex;
  gap: 0;
  margin-top: 10px;
  border: 2px solid #000;
}
.ai-key-input {
  flex: 1;
  background: #fff;
  color: #000;
  border: none;
  padding: 10px 12px;
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  outline: none;
}
.ai-key-input::placeholder {
  color: #000;
  opacity: 0.35;
}
.ai-key-input:disabled { background: #fafafa; cursor: not-allowed; }
.ai-key-toggle {
  background: #fff;
  color: #000;
  border: none;
  border-left: 2px solid #000;
  padding: 0 14px;
  cursor: pointer;
  font-family: 'Archivo Black', sans-serif;
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.ai-key-toggle:disabled { cursor: not-allowed; opacity: 0.5; }

.ai-run-row { display: flex; gap: 8px; margin-top: 10px; }
.ai-run-btn {
  flex: 1;
  background: #e4ff00;
  color: #000;
  border: 2px solid #000;
  padding: 12px 14px;
  cursor: pointer;
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  letter-spacing: -0.2px;
  text-transform: uppercase;
  transition: transform 120ms ease-out;
}
.ai-run-btn:hover:not(:disabled) { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 #000; }
.ai-run-btn:disabled {
  background: #f0f0f0;
  color: #000;
  cursor: not-allowed;
  opacity: 0.5;
}
.ai-cancel-btn {
  background: #fff;
  color: #000;
  border: 2px solid #000;
  padding: 12px 14px;
  cursor: pointer;
  font-family: 'Archivo Black', sans-serif;
  font-size: 11px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.ai-hint {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  line-height: 1.6;
  margin-top: 10px;
  opacity: 0.7;
}

.ai-error {
  background: #ff2d4b;
  color: #fff;
  border-bottom: 4px solid #000;
  padding: 12px 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.ai-error-mark {
  font-family: 'Archivo Black', sans-serif;
  font-size: 22px;
  line-height: 1;
}
.ai-error-text {
  font-family: 'Inter Tight', sans-serif;
  font-size: 12px;
  line-height: 1.5;
  font-weight: 600;
}

.ai-loading {
  padding: 28px 14px;
  text-align: center;
  border-bottom: 4px solid #000;
  background: #e4ff00;
}
.ai-loading-text {
  font-family: 'Archivo Black', sans-serif;
  font-size: 36px;
  letter-spacing: -1px;
  line-height: 0.9;
}
.ai-loading-sub {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-top: 8px;
  opacity: 0.7;
}

.ai-verdict {
  padding: 14px;
  border-bottom: 4px solid #000;
}
.ai-verdict--buy       { background: #7cff6b; }
.ai-verdict--negotiate { background: #e4ff00; }
.ai-verdict--avoid     { background: #ff2d4b; color: #fff; }
.ai-verdict--unknown   { background: #d4d4d4; }
.ai-verdict-tag {
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 2px;
  text-transform: uppercase;
}
.ai-verdict-label {
  font-family: 'Archivo Black', sans-serif;
  font-size: 32px;
  line-height: 0.95;
  letter-spacing: -1px;
  text-transform: uppercase;
  margin-top: 6px;
}
.ai-verdict-risk {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.5px;
  margin-top: 8px;
  border-top: 2px solid currentColor;
  padding-top: 6px;
}

.ai-summary {
  padding: 14px;
  border-bottom: 2px solid #000;
  font-family: 'Inter Tight', sans-serif;
  font-size: 13px;
  line-height: 1.6;
  font-weight: 500;
}

.ai-section-head {
  background: #000;
  color: #fff;
  padding: 6px 14px;
  font-family: 'Archivo Black', sans-serif;
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ai-section-count {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  opacity: 0.7;
}

.ai-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.ai-list-item {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #000;
  font-family: 'Inter Tight', sans-serif;
  font-size: 12px;
  line-height: 1.5;
}
.ai-list-mark {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
}
.ai-list-item--strength { background: #fff; }
.ai-list-item--neg { background: #fafafa; }
.ai-list-item--data { background: #f0f0f0; }

.ai-concern {
  padding: 10px 14px;
  border-bottom: 1px solid #000;
  border-left: 8px solid #000;
}
.ai-concern--low      { border-left-color: #7cff6b; }
.ai-concern--medium   { border-left-color: #e4ff00; }
.ai-concern--high     { border-left-color: #ff8f1f; background: #fff8ec; }
.ai-concern--critical { border-left-color: #ff2d4b; background: #fff0f2; }
.ai-concern-head {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.ai-concern-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: -0.1px;
}
.ai-concern-sev {
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 1px;
  padding: 2px 6px;
  border: 1px solid #000;
  text-transform: uppercase;
}
.ai-concern-sev--low      { background: #7cff6b; }
.ai-concern-sev--medium   { background: #e4ff00; }
.ai-concern-sev--high     { background: #ff8f1f; color: #000; }
.ai-concern-sev--critical { background: #ff2d4b; color: #fff; }
.ai-concern-rules {
  margin-left: auto;
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.5px;
  opacity: 0.6;
}
.ai-concern-detail {
  font-family: 'Inter Tight', sans-serif;
  font-size: 11px;
  line-height: 1.5;
  margin-top: 5px;
}

.ai-footer {
  padding: 8px 14px;
  background: #fafafa;
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 1px;
  text-transform: uppercase;
  text-align: right;
  opacity: 0.6;
}
`;

interface VerdictMeta {
  cls: string;
  label: string;
}

const VERDICT_META: Record<EvaluationVerdict, VerdictMeta> = {
  BUY: { cls: 'ai-verdict--buy', label: 'GO FOR IT.' },
  NEGOTIATE: { cls: 'ai-verdict--negotiate', label: 'NEGOTIATE.' },
  AVOID: { cls: 'ai-verdict--avoid', label: 'DO NOT BUY.' },
  UNKNOWN: { cls: 'ai-verdict--unknown', label: 'NOT SURE.' },
};

const RISK_LABEL: Record<EvaluationRiskLevel, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  critical: '매우 높음',
};

interface ProviderMeta {
  main: string;
  sub: string;
}

const PROVIDER_META: Record<LLMProvider, ProviderMeta> = {
  openai: { main: '◼ OPENAI', sub: 'GPT-4O-MINI' },
  gemini: { main: '◇ GEMINI', sub: '2.5 FLASH-LITE' },
};

export const AiEvaluationPanel: React.FC<AiEvaluationPanelProps> = ({
  parsed,
  facts,
  report,
}) => {
  const [provider, setProvider] = useState<LLMProvider>('openai');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<CarEvaluation | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canRun = canRunEvaluation(apiKey) && !loading;

  const handleRun = useCallback(async () => {
    if (!canRunEvaluation(apiKey)) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    setEvaluation(null);

    try {
      const result = await runCarEvaluation({
        provider,
        apiKey,
        input: { parsed, facts, report },
        signal: ac.signal,
      });
      if (!result) {
        setError('API key가 필요합니다.');
        return;
      }
      setEvaluation(result);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof LLMError) {
        setError(
          err.status
            ? `LLM 오류 (${err.provider} ${err.status}): ${err.message}`
            : `LLM 오류 (${err.provider}): ${err.message}`,
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey, provider, parsed, facts, report]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  return (
    <section className="ai-root">
      <header className="ai-header">
        <div className="ai-header-title">◼ AI EVALUATION</div>
        <div className="ai-header-note">KEY NOT STORED</div>
      </header>

      <div className="ai-section">
        <div className="ai-provider">
          {(['openai', 'gemini'] as const).map((p) => {
            const meta = PROVIDER_META[p];
            const active = provider === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                disabled={loading}
                className={`ai-provider-btn${active ? ' ai-provider-btn--active' : ''}`}
              >
                {meta.main}
                <span className="ai-provider-sub">{meta.sub}</span>
              </button>
            );
          })}
        </div>

        <div className="ai-key-row">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === 'openai' ? 'sk-...' : 'AIza...'}
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
            className="ai-key-input"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            disabled={loading}
            title={showKey ? '숨기기' : '보이기'}
            className="ai-key-toggle"
          >
            {showKey ? 'HIDE' : 'SHOW'}
          </button>
        </div>

        <div className="ai-run-row">
          <button
            type="button"
            onClick={handleRun}
            disabled={!canRun}
            className="ai-run-btn"
          >
            {loading
              ? '▣ ANALYZING...'
              : evaluation
                ? '↻ RE-EVALUATE'
                : '▶ RUN AI EVALUATION'}
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancel}
              className="ai-cancel-btn"
            >
              CANCEL
            </button>
          )}
        </div>

        {!canRunEvaluation(apiKey) && (
          <div className="ai-hint">
            {provider === 'openai'
              ? '// OpenAI API key를 입력하면 수집된 매물 데이터를 기반으로 AI가 종합 평가합니다.'
              : '// Google AI Studio API key를 입력하면 수집된 매물 데이터를 기반으로 AI가 종합 평가합니다.'}
          </div>
        )}
      </div>

      {error && (
        <div className="ai-error">
          <div className="ai-error-mark">✕</div>
          <div className="ai-error-text">{error}</div>
        </div>
      )}

      {loading && !evaluation && (
        <div className="ai-loading">
          <div className="ai-loading-text">ANALYZING</div>
          <div className="ai-loading-sub">// LLM REASONING IN PROGRESS</div>
        </div>
      )}

      {evaluation && !loading && <EvaluationView evaluation={evaluation} />}
    </section>
  );
};

// ── Subcomponents ────────────────────────────────────────────────

const EvaluationView: React.FC<{ evaluation: CarEvaluation }> = ({
  evaluation,
}) => {
  const meta = VERDICT_META[evaluation.verdict];
  return (
    <div>
      <div className={`ai-verdict ${meta.cls}`}>
        <div className="ai-verdict-tag">◆ AI VERDICT</div>
        <div className="ai-verdict-label">{meta.label}</div>
        <div className="ai-verdict-risk">
          OVERALL RISK · {RISK_LABEL[evaluation.overallRisk].toUpperCase()}
        </div>
      </div>

      <div className="ai-summary">{evaluation.summary}</div>

      {evaluation.strengths.length > 0 && (
        <>
          <div className="ai-section-head">
            <span>◼ STRENGTHS / 장점</span>
            <span className="ai-section-count">
              {String(evaluation.strengths.length).padStart(2, '0')}
            </span>
          </div>
          <ul className="ai-list">
            {evaluation.strengths.map((s, i) => (
              <li key={i} className="ai-list-item ai-list-item--strength">
                <span className="ai-list-mark">+</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {evaluation.concerns.length > 0 && (
        <>
          <div className="ai-section-head">
            <span>◼ CONCERNS / 우려</span>
            <span className="ai-section-count">
              {String(evaluation.concerns.length).padStart(2, '0')}
            </span>
          </div>
          <div>
            {evaluation.concerns.map((c, i) => (
              <ConcernCard key={i} finding={c} />
            ))}
          </div>
        </>
      )}

      {evaluation.negotiationPoints.length > 0 && (
        <>
          <div className="ai-section-head">
            <span>◼ NEGOTIATION / 협상 포인트</span>
            <span className="ai-section-count">
              {String(evaluation.negotiationPoints.length).padStart(2, '0')}
            </span>
          </div>
          <ul className="ai-list">
            {evaluation.negotiationPoints.map((p, i) => (
              <li key={i} className="ai-list-item ai-list-item--neg">
                <span className="ai-list-mark">→</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {evaluation.dataQualityWarnings.length > 0 && (
        <>
          <div className="ai-section-head">
            <span>◼ DATA GAPS / 데이터 부족</span>
            <span className="ai-section-count">
              {String(evaluation.dataQualityWarnings.length).padStart(2, '0')}
            </span>
          </div>
          <ul className="ai-list">
            {evaluation.dataQualityWarnings.map((w, i) => (
              <li key={i} className="ai-list-item ai-list-item--data">
                <span className="ai-list-mark">?</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="ai-footer">
        MODEL · {evaluation.model} ·{' '}
        {new Date(evaluation.generatedAt).toLocaleTimeString()}
      </div>
    </div>
  );
};

const ConcernCard: React.FC<{ finding: EvaluationFinding }> = ({ finding }) => {
  return (
    <div className={`ai-concern ai-concern--${finding.severity}`}>
      <div className="ai-concern-head">
        <span className="ai-concern-title">{finding.title}</span>
        <span className={`ai-concern-sev ai-concern-sev--${finding.severity}`}>
          {RISK_LABEL[finding.severity]}
        </span>
        {finding.evidenceRuleIds.length > 0 && (
          <span className="ai-concern-rules">
            {finding.evidenceRuleIds.join(' · ')}
          </span>
        )}
      </div>
      <div className="ai-concern-detail">{finding.detail}</div>
    </div>
  );
};
