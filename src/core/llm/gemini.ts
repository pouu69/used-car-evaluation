/**
 * Google Gemini (generativelanguage.googleapis.com) 구현.
 * - API key는 호출자가 매 인스턴스 생성 시 주입 (저장 X).
 * - OpenAI 포맷 messages를 Gemini contents/systemInstruction 포맷으로 매핑.
 * - 네트워크 실패/비정상 응답은 LLMError로 통일.
 */
import { assertMessagesNonEmpty, fetchLLM, validateApiKey } from './base.js';
import {
  LLMError,
  type LLMClient,
  type LLMCompletionRequest,
  type LLMCompletionResult,
  type LLMMessage,
} from './types.js';

const PROVIDER = { id: 'gemini', label: 'Gemini' } as const;
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
// 2.5-flash-lite가 가장 저렴한 tier. 구조화된 JSON 출력엔 충분.
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

export interface GeminiClientConfig {
  /** 사용자 입력으로 받은 Google AI Studio API key. 메모리에만 보관. */
  apiKey: string;
  /** 기본: https://generativelanguage.googleapis.com/v1beta */
  baseUrl?: string;
  /** 기본: gemini-2.5-flash */
  defaultModel?: string;
}

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { role?: string; parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  modelVersion?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { code?: number; message?: string; status?: string };
}

/**
 * OpenAI 스타일 messages → Gemini contents + systemInstruction.
 * - system 메시지들은 모두 모아서 systemInstruction으로.
 * - assistant → 'model', user → 'user'.
 * - 인접한 동일 role은 하나의 content로 병합 (Gemini는 교차 필수 X이지만 안전).
 */
const toGeminiPayload = (
  messages: LLMMessage[],
): { contents: GeminiContent[]; systemInstruction?: { parts: GeminiPart[] } } => {
  const systemTexts: string[] = [];
  const contents: GeminiContent[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      systemTexts.push(m.content);
      continue;
    }
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text: m.content });
    } else {
      contents.push({ role, parts: [{ text: m.content }] });
    }
  }

  return {
    contents,
    systemInstruction:
      systemTexts.length > 0
        ? { parts: [{ text: systemTexts.join('\n\n') }] }
        : undefined,
  };
};

export class GeminiClient implements LLMClient {
  readonly provider = PROVIDER.id;
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #defaultModel: string;

  constructor(cfg: GeminiClientConfig) {
    this.#apiKey = validateApiKey(cfg.apiKey, PROVIDER);
    this.#baseUrl = (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#defaultModel = cfg.defaultModel ?? DEFAULT_MODEL;
  }

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResult> {
    assertMessagesNonEmpty(req.messages, PROVIDER);

    const model = req.model ?? this.#defaultModel;
    const { contents, systemInstruction } = toGeminiPayload(req.messages);

    const generationConfig: Record<string, unknown> = {
      // Gemini 2.5 계열은 기본 thinking이 켜져 있어서 maxOutputTokens 예산을
      // 숨겨진 thinking 토큰이 먼저 소진한다. 우리는 구조화된 JSON 출력을
      // 원하므로 thinking을 완전히 끈다.
      thinkingConfig: { thinkingBudget: 0 },
    };
    if (req.temperature !== undefined) generationConfig.temperature = req.temperature;
    if (req.maxTokens !== undefined) generationConfig.maxOutputTokens = req.maxTokens;
    if (req.responseFormat === 'json_object') {
      generationConfig.responseMimeType = 'application/json';
    }

    const body: Record<string, unknown> = { contents };
    if (systemInstruction) body.systemInstruction = systemInstruction;
    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    const url = `${this.#baseUrl}/models/${encodeURIComponent(model)}:generateContent`;

    const json = (await fetchLLM(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // x-goog-api-key 헤더를 쓰면 URL에 키가 노출되지 않음.
          'x-goog-api-key': this.#apiKey,
        },
        body: JSON.stringify(body),
        signal: req.signal,
      },
      PROVIDER,
    )) as GeminiGenerateResponse;

    const candidate = json.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const content = parts.map((p) => p.text ?? '').join('');

    // finishReason이 MAX_TOKENS면 content가 JSON 중간에서 잘렸을 확률이 높다.
    // 상위에서 JSON.parse가 "Unterminated string"으로 뻗기 전에 명시적으로 알린다.
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new LLMError(
        'Gemini response truncated (MAX_TOKENS). Try increasing maxTokens.',
        { provider: PROVIDER.id },
      );
    }

    const usage = json.usageMetadata;
    return {
      content,
      model: json.modelVersion ?? model,
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: usage.candidatesTokenCount ?? 0,
            totalTokens:
              usage.totalTokenCount ??
              (usage.promptTokenCount ?? 0) + (usage.candidatesTokenCount ?? 0),
          }
        : undefined,
    };
  }
}
