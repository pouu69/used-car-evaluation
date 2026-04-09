/**
 * LLM 호출 레이어 — provider-agnostic 타입.
 * 구현체(OpenAIClient 등)는 이 인터페이스를 만족해야 한다.
 */

export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  /** Provider 기본 모델을 override. */
  model?: string;
  /** 0.0 ~ 2.0. 미지정 시 provider 기본값. */
  temperature?: number;
  /** 응답 최대 토큰. */
  maxTokens?: number;
  /** 'json_object' 설정 시 JSON 강제 (OpenAI JSON mode). */
  responseFormat?: 'text' | 'json_object';
  /** 호출 취소용. */
  signal?: AbortSignal;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMCompletionResult {
  content: string;
  model: string;
  usage?: LLMUsage;
}

export interface LLMClient {
  readonly provider: string;
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResult>;
}

/** LLM 호출 중 발생한 에러. HTTP status가 있으면 함께 전달. */
export class LLMError extends Error {
  readonly status?: number;
  readonly provider: string;

  constructor(message: string, opts: { status?: number; provider: string }) {
    super(message);
    this.name = 'LLMError';
    this.status = opts.status;
    this.provider = opts.provider;
  }
}
