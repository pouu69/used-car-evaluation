/**
 * Rendered view of a completed CarEvaluation: verdict header,
 * summary, strengths/concerns/negotiation/data-gap sections.
 */
import React from 'react';
import type {
  CarEvaluation,
  EvaluationRiskLevel,
  EvaluationVerdict,
} from '@/core/evaluation';
import { ConcernCard } from './ConcernCard';
import type { VerdictMeta } from './styles';

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

interface EvaluationViewProps {
  evaluation: CarEvaluation;
}

export function EvaluationView({ evaluation }: EvaluationViewProps) {
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
}
