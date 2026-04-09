/**
 * LLM 중고차 평가 실행기.
 *
 * - evaluateCar: 이미 만들어진 LLMClient 인스턴스를 주입받아 호출.
 * - runCarEvaluation: apiKey + provider를 받아서 클라이언트를 만들고 호출.
 *   **apiKey가 비어 있으면 LLM을 호출하지 않고 null을 반환**한다.
 *   (호출부에서 "API key 설정 전에는 평가 기능 자체가 돌지 않음"을 보장하는 게이트.)
 */
import { z } from 'zod';
import {
  LLMError,
  createLLMClient,
  type LLMClient,
  type LLMProvider,
} from '../llm/index.js';
import { buildEvaluationPrompts } from './prompt.js';
import type { CarEvaluation, EvaluationInput } from './types.js';

const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
const verdictSchema = z.enum(['BUY', 'NEGOTIATE', 'AVOID', 'UNKNOWN']);

const findingSchema = z.object({
  title: z.string().min(1),
  severity: riskLevelSchema,
  detail: z.string().min(1),
  evidenceRuleIds: z.array(z.string()).default([]),
});

const evaluationBodySchema = z.object({
  verdict: verdictSchema,
  overallRisk: riskLevelSchema,
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  concerns: z.array(findingSchema).default([]),
  negotiationPoints: z.array(z.string()).default([]),
  dataQualityWarnings: z.array(z.string()).default([]),
});

export interface EvaluateCarOptions {
  client: LLMClient;
  input: EvaluationInput;
  /** provider 기본 모델을 override 하고 싶을 때만. */
  model?: string;
  signal?: AbortSignal;
  /** 기본 0.2. 결정적인 평가를 위해 낮게. */
  temperature?: number;
  /**
   * 기본 1024. 타이트해진 프롬프트 예산:
   *   summary(~80) + strengths(~40) + concerns(~180) +
   *   negotiationPoints(~280) + dataQualityWarnings(~40) +
   *   JSON 오버헤드(~120) ≈ 740 tokens. 1024 로 약 35% 여유.
   * Gemini 2.5 flash-lite 기준 출력 1k 토큰 < $0.0005.
   */
  maxTokens?: number;
}

const DEFAULT_MAX_TOKENS = 1024;
const RETRY_MAX_TOKENS = 2048;

const parseEvaluationJson = (
  content: string,
  provider: string,
): z.infer<typeof evaluationBodySchema> => {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch (err) {
    const preview =
      content.length > 200 ? `${content.slice(0, 200)}…` : content;
    throw new LLMError(
      `LLM evaluation response was not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      } — content preview: ${preview}`,
      { provider },
    );
  }
  const parsed = evaluationBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new LLMError(
      `LLM evaluation response did not match schema: ${parsed.error.message}`,
      { provider },
    );
  }
  return parsed.data;
};

/** 주어진 LLMClient로 평가를 수행. (API key는 이미 client 안에 있음) */
export const evaluateCar = async (
  opts: EvaluateCarOptions,
): Promise<CarEvaluation> => {
  const { system, user } = buildEvaluationPrompts(opts.input);
  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];

  const firstBudget = opts.maxTokens ?? DEFAULT_MAX_TOKENS;

  const call = (maxTokens: number) =>
    opts.client.complete({
      messages,
      responseFormat: 'json_object',
      temperature: opts.temperature ?? 0.2,
      maxTokens,
      model: opts.model,
      signal: opts.signal,
    });

  let res;
  try {
    res = await call(firstBudget);
  } catch (err) {
    // Gemini explicitly throws on MAX_TOKENS before the caller ever sees the
    // content. Retry once with a larger budget when the user didn't specify
    // their own override. This gives the prompt a second chance to finish
    // cleanly without silently burning cost on every call.
    if (
      opts.maxTokens === undefined &&
      err instanceof LLMError &&
      /MAX_TOKENS/i.test(err.message)
    ) {
      res = await call(RETRY_MAX_TOKENS);
    } else {
      throw err;
    }
  }

  const data = parseEvaluationJson(res.content, opts.client.provider);
  return {
    schemaVersion: 1,
    ...data,
    model: res.model,
    generatedAt: Date.now(),
  };
};

export interface RunCarEvaluationOptions {
  provider: LLMProvider;
  /** 사용자 input으로 받은 API key. null/빈 문자열이면 평가를 수행하지 않는다. */
  apiKey: string | null | undefined;
  input: EvaluationInput;
  model?: string;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

/**
 * apiKey 게이팅 + 평가 실행을 한 번에.
 *
 * @returns 평가 결과. **apiKey가 없으면 null**.
 */
export const runCarEvaluation = async (
  opts: RunCarEvaluationOptions,
): Promise<CarEvaluation | null> => {
  const key = opts.apiKey?.trim();
  if (!key) return null;

  const client = createLLMClient({
    provider: opts.provider,
    apiKey: key,
    defaultModel: opts.model,
  });

  return evaluateCar({
    client,
    input: opts.input,
    model: opts.model,
    signal: opts.signal,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
  });
};

/** apiKey가 유효한(비어 있지 않은) 값인지만 확인. 네트워크 호출 없음. */
export const canRunEvaluation = (
  apiKey: string | null | undefined,
): apiKey is string => typeof apiKey === 'string' && apiKey.trim().length > 0;
