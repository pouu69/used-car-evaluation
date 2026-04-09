/**
 * LLM 기반 중고차 평가 결과 타입.
 *
 * Rule 엔진(RuleReport)이 "기계적으로 판정 가능한" 리스크를 평가한다면,
 * 이 레이어는 그 위에 LLM의 자연어 해석을 얹는다:
 *  - 룰 결과 + 파싱된 원본 스펙을 사람이 읽을 수 있는 진단으로 합성
 *  - 강점/우려/협상 포인트/데이터 품질 경고를 분리해서 반환
 */
import type { EncarParsedData } from '../types/ParsedData.js';
import type { ChecklistFacts } from '../types/ChecklistFacts.js';
import type { RuleReport } from '../types/RuleTypes.js';

export type EvaluationRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** 최종 구매 권고. 룰 엔진의 Verdict와 1:1 매핑되진 않음 (LLM 종합). */
export type EvaluationVerdict = 'BUY' | 'NEGOTIATE' | 'AVOID' | 'UNKNOWN';

export interface EvaluationFinding {
  title: string;
  severity: EvaluationRiskLevel;
  detail: string;
  /** 이 finding이 근거로 삼은 룰 ID들 (R01..R11). 없으면 빈 배열. */
  evidenceRuleIds: string[];
}

export interface CarEvaluation {
  schemaVersion: 1;
  verdict: EvaluationVerdict;
  overallRisk: EvaluationRiskLevel;
  /** 3~5문장 종합 요약 (한국어). */
  summary: string;
  /** 장점/긍정 포인트. 0개 이상. */
  strengths: string[];
  /** 우려 사항. severity별로 정렬된 finding 목록. */
  concerns: EvaluationFinding[];
  /** 딜러와 협상할 때 쓸 포인트 / 추가로 확인해야 할 질문. */
  negotiationPoints: string[];
  /** 데이터가 부족해서 판단 불가능했던 항목. */
  dataQualityWarnings: string[];
  /** 응답을 만든 모델 ID (provider가 알려준 실제 값). */
  model: string;
  /** epoch ms. */
  generatedAt: number;
}

export interface EvaluationInput {
  parsed: EncarParsedData;
  facts: ChecklistFacts;
  report: RuleReport;
}
