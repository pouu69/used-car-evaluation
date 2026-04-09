/**
 * Google Gemini (generativelanguage.googleapis.com) 구현.
 * - API key는 호출자가 매 인스턴스 생성 시 주입 (저장 X).
 * - OpenAI 포맷 messages를 Gemini contents/systemInstruction 포맷으로 매핑.
 * - 네트워크 실패/비정상 응답은 LLMError로 통일.
 */
import {
  LLMError,
  type LLMClient,
  type LLMCompletionRequest,
  type LLMCompletionResult,
  type LLMMessage,
} from './types.js';

const PROVIDER = 'gemini';
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
  readonly provider = PROVIDER;
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #defaultModel: string;

  constructor(cfg: GeminiClientConfig) {
    const key = cfg.apiKey?.trim() ?? '';
    if (!key) {
      throw new LLMError('Gemini API key is required', { provider: PROVIDER });
    }
    // HTTP headers must be ISO-8859-1 (Latin-1). A pasted key that accidentally
    // carries a trailing Korean quote, fullwidth char, or smart quote will
    // make `fetch` throw `String contains non ISO-8859-1 code point` deep
    // inside the request setup — a confusing error surface. Fail fast here
    // with a user-actionable message instead.
    // eslint-disable-next-line no-control-regex
    if (!/^[\x20-\x7e]+$/.test(key)) {
      throw new LLMError(
        'Gemini API key contains non-ASCII characters — check for pasted smart quotes or hidden whitespace',
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

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // x-goog-api-key 헤더를 쓰면 URL에 키가 노출되지 않음.
          'x-goog-api-key': this.#apiKey,
        },
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (err: unknown) {
      throw new LLMError(
        `Gemini request failed: ${err instanceof Error ? err.message : String(err)}`,
        { provider: PROVIDER },
      );
    }

    let json: GeminiGenerateResponse | null = null;
    try {
      json = (await res.json()) as GeminiGenerateResponse;
    } catch {
      /* non-JSON — fall through */
    }

    if (!res.ok) {
      const detail = json?.error?.message ?? res.statusText;
      throw new LLMError(`Gemini ${res.status}: ${detail}`, {
        status: res.status,
        provider: PROVIDER,
      });
    }
    if (!json) {
      throw new LLMError('Gemini returned a non-JSON response', {
        status: res.status,
        provider: PROVIDER,
      });
    }

    const candidate = json.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const content = parts.map((p) => p.text ?? '').join('');

    // finishReason이 MAX_TOKENS면 content가 JSON 중간에서 잘렸을 확률이 높다.
    // 상위에서 JSON.parse가 "Unterminated string"으로 뻗기 전에 명시적으로 알린다.
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new LLMError(
        'Gemini response truncated (MAX_TOKENS). Try increasing maxTokens.',
        { status: res.status, provider: PROVIDER },
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
