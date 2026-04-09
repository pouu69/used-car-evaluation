/**
 * Single concern card for the AI evaluation results list.
 */
import React from 'react';
import type {
  EvaluationFinding,
  EvaluationRiskLevel,
} from '@/core/evaluation';

const RISK_LABEL: Record<EvaluationRiskLevel, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  critical: '매우 높음',
};

interface ConcernCardProps {
  finding: EvaluationFinding;
}

export function ConcernCard({ finding }: ConcernCardProps) {
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
}
