/**
 * Provider selector + API key input + run/cancel controls for the
 * AI evaluation panel. Pure presentational — state lives in the
 * parent AiEvaluationPanel.
 */
import React from 'react';
import { canRunEvaluation } from '@/core/evaluation';
import type { LLMProvider } from '@/core/llm';
import type { ProviderMeta } from './styles';

const PROVIDER_META: Record<LLMProvider, ProviderMeta> = {
  openai: { main: '◼ OPENAI', sub: 'GPT-4O-MINI' },
  gemini: { main: '◇ GEMINI', sub: '2.5 FLASH-LITE' },
};

interface AiProviderFormProps {
  provider: LLMProvider;
  apiKey: string;
  showKey: boolean;
  loading: boolean;
  hasEvaluation: boolean;
  onProviderChange: (provider: LLMProvider) => void;
  onApiKeyChange: (apiKey: string) => void;
  onToggleShowKey: () => void;
  onRun: () => void;
  onCancel: () => void;
}

export function AiProviderForm({
  provider,
  apiKey,
  showKey,
  loading,
  hasEvaluation,
  onProviderChange,
  onApiKeyChange,
  onToggleShowKey,
  onRun,
  onCancel,
}: AiProviderFormProps) {
  const canRun = canRunEvaluation(apiKey) && !loading;

  return (
    <div className="ai-section">
      <div className="ai-provider">
        {(['openai', 'gemini'] as const).map((p) => {
          const meta = PROVIDER_META[p];
          const active = provider === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onProviderChange(p)}
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
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={provider === 'openai' ? 'sk-...' : 'AIza...'}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
          className="ai-key-input"
        />
        <button
          type="button"
          onClick={onToggleShowKey}
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
          onClick={onRun}
          disabled={!canRun}
          className="ai-run-btn"
        >
          {loading
            ? '▣ ANALYZING...'
            : hasEvaluation
              ? '↻ RE-EVALUATE'
              : '▶ RUN AI EVALUATION'}
        </button>
        {loading && (
          <button type="button" onClick={onCancel} className="ai-cancel-btn">
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
  );
}
