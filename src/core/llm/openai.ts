/**
 * OpenAI Chat Completions 구현.
 * - API key는 호출자가 매 인스턴스 생성 시 주입 (저장 X).
 * - 네트워크 실패/비정상 응답은 LLMError로 통일.
 */
import {
  LLMError,
  type LLMClient,
  type LLMCompletionRequest,
  type LLMCompletionResult,
} from './types.js';

const PROVIDER = 'openai';
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
  readonly provider = PROVIDER;
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #defaultModel: string;

  constructor(cfg: OpenAIClientConfig) {
    const key = cfg.apiKey?.trim() ?? '';
    if (!key) {
      throw new LLMError('OpenAI API key is required', { provider: PROVIDER });
    }
    // `Authorization: Bearer …` must be ISO-8859-1. Pasted smart quotes or
    // hidden fullwidth whitespace make `fetch` throw from deep inside header
    // setup. Fail fast with a user-actionable error.
    // eslint-disable-next-line no-control-regex
    if (!/^[\x20-\x7e]+$/.test(key)) {
      throw new LLMError(
        'OpenAI API key contains non-ASCII characters — check for pasted smart quotes or hidden whitespace',
        { provider: PROVIDER },
      );
    }
    this.#apiKey = key;
    this.#baseUrl = (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#defaultModel = cfg.defaultModel ?? DEFAULT_MODEL;
  }

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResult> {
    if (!req.messages || req.messages.length === 0) {
      throw new LLMError('messages must not be empty', { provider: PROVIDER });
    }

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

    let res: Response;
    try {
      res = await fetch(`${this.#baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.#apiKey}`,
        },
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (err: unknown) {
      throw new LLMError(
        `OpenAI request failed: ${err instanceof Error ? err.message : String(err)}`,
        { provider: PROVIDER },
      );
    }

    let json: OpenAIChatResponse | null = null;
    try {
      json = (await res.json()) as OpenAIChatResponse;
    } catch {
      /* non-JSON response — fall through */
    }

    if (!res.ok) {
      const detail = json?.error?.message ?? res.statusText;
      throw new LLMError(`OpenAI ${res.status}: ${detail}`, {
        status: res.status,
        provider: PROVIDER,
      });
    }
    if (!json) {
      throw new LLMError('OpenAI returned a non-JSON response', {
        status: res.status,
        provider: PROVIDER,
      });
    }

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
