/**
 * OpenAI Chat Completions 구현.
 * - API key는 호출자가 매 인스턴스 생성 시 주입 (저장 X).
 * - 네트워크 실패/비정상 응답은 LLMError로 통일.
 */
import { assertMessagesNonEmpty, fetchLLM, validateApiKey } from './base.js';
import {
  type LLMClient,
  type LLMCompletionRequest,
  type LLMCompletionResult,
} from './types.js';

const PROVIDER = { id: 'openai', label: 'OpenAI' } as const;
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

export interface OpenAIClientConfig {
  /** 사용자 입력으로 받은 OpenAI API key. 메모리에만 보관. */
  apiKey: string;
  /** 기본: https://api.openai.com/v1 */
  baseUrl?: string;
  /** 기본: gpt-4o-mini */
  defaultModel?: string;
}

interface OpenAIChatResponse {
  model?: string;
  choices?: Array<{
    message?: { role: string; content: string | null };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: { message?: string; type?: string; code?: string };
}

export class OpenAIClient implements LLMClient {
  readonly provider = PROVIDER.id;
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #defaultModel: string;

  constructor(cfg: OpenAIClientConfig) {
    this.#apiKey = validateApiKey(cfg.apiKey, PROVIDER);
    this.#baseUrl = (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#defaultModel = cfg.defaultModel ?? DEFAULT_MODEL;
  }

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResult> {
    assertMessagesNonEmpty(req.messages, PROVIDER);

    const model = req.model ?? this.#defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    if (req.responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const json = (await fetchLLM(
      `${this.#baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.#apiKey}`,
        },
        body: JSON.stringify(body),
        signal: req.signal,
      },
      PROVIDER,
    )) as OpenAIChatResponse;

    const choice = json.choices?.[0];
    const content = choice?.message?.content ?? '';
    return {
      content,
      model: json.model ?? model,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }
}
