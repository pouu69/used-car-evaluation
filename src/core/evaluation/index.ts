/**
 * 중고차 LLM 평가 레이어 진입점.
 *
 * 사용 예:
 *   import { runCarEvaluation } from '@/core/evaluation';
 *
 *   const evaluation = await runCarEvaluation({
 *     provider: 'openai',
 *     apiKey: userInput,            // 없으면 null 반환 (LLM 호출 X)
 *     input: { parsed, facts, report },
 *   });
 */
export type {
  CarEvaluation,
  EvaluationFinding,
  EvaluationInput,
  EvaluationRiskLevel,
  EvaluationVerdict,
} from './types.js';

export {
  EVALUATION_SYSTEM_PROMPT,
  buildEvaluationContext,
  buildEvaluationPrompts,
  buildEvaluationUserPrompt,
} from './prompt.js';

export {
  canRunEvaluation,
  evaluateCar,
  runCarEvaluation,
  type EvaluateCarOptions,
  type RunCarEvaluationOptions,
} from './evaluateCar.js';
