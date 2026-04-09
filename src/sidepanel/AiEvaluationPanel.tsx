/**
 * AI 평가 패널.
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

const VERDICT_STYLE: Record<
  EvaluationVerdict,
  { bg: string; label: string; emoji: string }
> = {
  BUY: { bg: '#2d9d5c', label: '구매 권장', emoji: '✅' },
  NEGOTIATE: { bg: '#d4951a', label: '협상 여지', emoji: '💬' },
  AVOID: { bg: '#c82333', label: '비추천', emoji: '🚨' },
  UNKNOWN: { bg: '#6a7380', label: '판단 보류', emoji: '❔' },
};

const RISK_COLOR: Record<EvaluationRiskLevel, string> = {
  low: '#2d9d5c',
  medium: '#d4951a',
  high: '#e06a1f',
  critical: '#c82333',
};

const RISK_LABEL: Record<EvaluationRiskLevel, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  critical: '매우 높음',
};

const PROVIDER_LABEL: Record<LLMProvider, string> = {
  openai: 'OpenAI (gpt-4o-mini)',
  gemini: 'Gemini (2.5-flash-lite)',
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
    <section
      style={{
        background: '#0f141a',
        border: '1px solid #1f262f',
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>🤖</span>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 0.3,
          }}
        >
          AI 종합 평가
        </h3>
        <span
          style={{
            fontSize: 10,
            opacity: 0.5,
            marginLeft: 'auto',
          }}
        >
          키는 저장되지 않음
        </span>
      </header>

      {/* Provider + API key input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['openai', 'gemini'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              disabled={loading}
              style={{
                flex: 1,
                background: provider === p ? '#6aa1ff' : 'transparent',
                color: provider === p ? '#0b0d10' : '#b3bac3',
                border: `1px solid ${provider === p ? '#6aa1ff' : '#2a3138'}`,
                padding: '6px 10px',
                borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {PROVIDER_LABEL[p]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              provider === 'openai' ? 'sk-...' : 'AIza...'
            }
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              background: '#161b22',
              color: '#e6edf3',
              border: '1px solid #2a3138',
              padding: '8px 10px',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'ui-monospace, monospace',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            disabled={loading}
            title={showKey ? '숨기기' : '보이기'}
            style={{
              background: 'transparent',
              color: '#b3bac3',
              border: '1px solid #2a3138',
              padding: '0 10px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {showKey ? '🙈' : '👁'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={handleRun}
            disabled={!canRun}
            style={{
              flex: 1,
              background: canRun ? '#6aa1ff' : '#2a3138',
              color: canRun ? '#0b0d10' : '#6a7380',
              border: 'none',
              padding: '10px 14px',
              borderRadius: 8,
              cursor: canRun ? 'pointer' : 'not-allowed',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {loading
              ? '평가 중...'
              : evaluation
                ? '↻ 다시 평가'
                : 'AI 평가 받기'}
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancel}
              style={{
                background: 'transparent',
                color: '#b3bac3',
                border: '1px solid #2a3138',
                padding: '10px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              취소
            </button>
          )}
        </div>

        {!canRunEvaluation(apiKey) && (
          <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.5 }}>
            {provider === 'openai'
              ? 'OpenAI API key를 입력하면 수집된 매물 데이터를 기반으로 AI가 종합 평가합니다.'
              : 'Google AI Studio API key를 입력하면 수집된 매물 데이터를 기반으로 AI가 종합 평가합니다.'}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: '#2a1618',
            border: '1px solid #5a2429',
            color: '#ffb3b3',
            padding: 10,
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Result */}
      {evaluation && !loading && <EvaluationView evaluation={evaluation} />}
    </section>
  );
};

// ── Subcomponents ────────────────────────────────────────────────

const EvaluationView: React.FC<{ evaluation: CarEvaluation }> = ({
  evaluation,
}) => {
  const v = VERDICT_STYLE[evaluation.verdict];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* verdict header */}
      <div
        style={{
          background: v.bg,
          color: '#fff',
          padding: '10px 12px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 22 }}>{v.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{v.label}</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>
            전반 리스크: {RISK_LABEL[evaluation.overallRisk]}
          </div>
        </div>
      </div>

      {/* summary */}
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.6,
          color: '#e6edf3',
        }}
      >
        {evaluation.summary}
      </p>

      {/* strengths */}
      {evaluation.strengths.length > 0 && (
        <EvalSection title="장점" color="#2d9d5c">
          {evaluation.strengths.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </EvalSection>
      )}

      {/* concerns */}
      {evaluation.concerns.length > 0 && (
        <div>
          <SectionLabel text="우려 사항" color="#c82333" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {evaluation.concerns.map((c, i) => (
              <ConcernCard key={i} finding={c} />
            ))}
          </div>
        </div>
      )}

      {/* negotiationPoints */}
      {evaluation.negotiationPoints.length > 0 && (
        <EvalSection title="협상/확인 포인트" color="#6aa1ff">
          {evaluation.negotiationPoints.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </EvalSection>
      )}

      {/* dataQualityWarnings */}
      {evaluation.dataQualityWarnings.length > 0 && (
        <EvalSection title="데이터 부족" color="#6a7380">
          {evaluation.dataQualityWarnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </EvalSection>
      )}

      <div
        style={{
          fontSize: 10,
          opacity: 0.4,
          textAlign: 'right',
          marginTop: 2,
        }}
      >
        model · {evaluation.model} ·{' '}
        {new Date(evaluation.generatedAt).toLocaleTimeString()}
      </div>
    </div>
  );
};

const SectionLabel: React.FC<{ text: string; color: string }> = ({
  text,
  color,
}) => (
  <div
    style={{
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontWeight: 800,
      color,
      margin: '0 0 6px 2px',
    }}
  >
    {text}
  </div>
);

const EvalSection: React.FC<{
  title: string;
  color: string;
  children: React.ReactNode;
}> = ({ title, color, children }) => (
  <div>
    <SectionLabel text={title} color={color} />
    <ul
      style={{
        margin: 0,
        paddingLeft: 18,
        fontSize: 12,
        lineHeight: 1.6,
        color: '#e6edf3',
      }}
    >
      {children}
    </ul>
  </div>
);

const ConcernCard: React.FC<{ finding: EvaluationFinding }> = ({ finding }) => {
  const color = RISK_COLOR[finding.severity];
  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #20262e',
        borderLeft: `3px solid ${color}`,
        padding: '8px 10px',
        borderRadius: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <span>{finding.title}</span>
        <span
          style={{
            fontSize: 9,
            background: color,
            color: '#fff',
            padding: '1px 6px',
            borderRadius: 8,
            letterSpacing: 0.3,
          }}
        >
          {RISK_LABEL[finding.severity]}
        </span>
        {finding.evidenceRuleIds.length > 0 && (
          <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 'auto' }}>
            {finding.evidenceRuleIds.join(', ')}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          opacity: 0.85,
          marginTop: 4,
          lineHeight: 1.5,
        }}
      >
        {finding.detail}
      </div>
    </div>
  );
};
