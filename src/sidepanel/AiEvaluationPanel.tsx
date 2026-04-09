/**
 * AI 평가 패널 — Brutalist Scoreboard edition.
 *
 * - API key는 **메모리(React state)에만** 저장한다. localStorage/IndexedDB/
 *   chrome.storage 어디에도 넣지 않는다. 사이드패널이 닫히거나 새로고침되면
 *   다시 입력해야 한다 — 이게 의도된 동작.
 * - API key가 비어 있으면 평가 버튼이 disabled. runCarEvaluation도
 *   자체적으로 null을 반환하지만 UI 레벨에서 미리 차단.
 *
 * 이 파일은 상태/핸들러만 담당하고, UI는 components/ai/ 하위로 분리되어 있다.
 */
import React, { useCallback, useRef, useState } from 'react';
import type { EncarParsedData } from '@/core/types/ParsedData';
import type { ChecklistFacts } from '@/core/types/ChecklistFacts';
import type { RuleReport } from '@/core/types/RuleTypes';
import {
  canRunEvaluation,
  runCarEvaluation,
  type CarEvaluation,
} from '@/core/evaluation';
import { LLMError, type LLMProvider } from '@/core/llm';
import { AiProviderForm } from './components/ai/AiProviderForm';
import { EvaluationView } from './components/ai/EvaluationView';
import { aiPanelCss } from './components/ai/styles';

export const css: string = aiPanelCss;

interface AiEvaluationPanelProps {
  parsed: EncarParsedData;
  facts: ChecklistFacts;
  report: RuleReport;
}

export function AiEvaluationPanel({
  parsed,
  facts,
  report,
}: AiEvaluationPanelProps) {
  const [provider, setProvider] = useState<LLMProvider>('openai');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<CarEvaluation | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

      <AiProviderForm
        provider={provider}
        apiKey={apiKey}
        showKey={showKey}
        loading={loading}
        hasEvaluation={evaluation !== null}
        onProviderChange={setProvider}
        onApiKeyChange={setApiKey}
        onToggleShowKey={() => setShowKey((v) => !v)}
        onRun={handleRun}
        onCancel={handleCancel}
      />

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
}
