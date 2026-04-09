/**
 * LLM 레이어 진입점.
 *
 * 사용 예:
 *   const client = createLLMClient({ provider: 'openai', apiKey: userInput });
 *   // or
 *   const client = createLLMClient({ provider: 'gemini', apiKey: userInput });
 *
 *   const res = await client.complete({
 *     messages: [
 *       { role: 'system', content: '...' },
 *       { role: 'user', content: '...' },
 *     ],
 *   });
 *
 * 주의: API key는 저장하지 않는다. 호출자가 매 세션마다 사용자 입력을
 * 받아서 클라이언트 인스턴스를 만들고, 인스턴스가 사라지면 키도 사라진다.
 */
export type {
  LLMClient,
  LLMCompletionRequest,
  LLMCompletionResult,
  LLMMessage,
  LLMRole,
  LLMUsage,
} from './types.js';
export { LLMError } from './types.js';
export { OpenAIClient, type OpenAIClientConfig } from './openai.js';
export { GeminiClient, type GeminiClientConfig } from './gemini.js';

import { OpenAIClient } from './openai.js';
import { GeminiClient } from './gemini.js';
import type { LLMClient } from './types.js';

export type LLMProvider = 'openai' | 'gemini';

export interface CreateLLMClientOptions {
  provider: LLMProvider;
  /** 사용자가 입력한 API key. 메모리에만 보관. */
  apiKey: string;
  /** provider별 기본값을 override. */
  baseUrl?: string;
  /** provider별 기본 모델을 override. */
  defaultModel?: string;
}

/** 사용자 입력 API key로 LLMClient 인스턴스를 생성한다. */
export const createLLMClient = (opts: CreateLLMClientOptions): LLMClient => {
  switch (opts.provider) {
    case 'openai':
      return new OpenAIClient({
        apiKey: opts.apiKey,
        baseUrl: opts.baseUrl,
        defaultModel: opts.defaultModel,
      });
    case 'gemini':
      return new GeminiClient({
        apiKey: opts.apiKey,
        baseUrl: opts.baseUrl,
        defaultModel: opts.defaultModel,
      });
    default: {
      const _exhaustive: never = opts.provider;
      throw new Error(`unsupported LLM provider: ${String(_exhaustive)}`);
    }
  }
};
