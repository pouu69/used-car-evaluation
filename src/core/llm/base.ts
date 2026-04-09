/**
 * Shared helpers for LLM provider clients.
 *
 * Extracts behavior that is byte-identical (modulo provider label) across
 * OpenAI and Gemini clients: API-key validation, empty-messages guard, and
 * the fetch/response-parse pipeline that normalizes errors into `LLMError`.
 *
 * Provider-specific payload shaping, request URL/headers, and response
 * decoding stay in the respective provider files.
 */
import { LLMError, type LLMMessage } from './types.js';

/** Provider display name → used verbatim in thrown error messages. */
export interface ProviderLabel {
  /** Internal provider id, e.g. 'openai' | 'gemini'. */
  id: string;
  /** Human-facing label used in error messages, e.g. 'OpenAI' | 'Gemini'. */
  label: string;
}

/**
 * Validate a user-supplied API key.
 *
 * HTTP headers must be ISO-8859-1 (Latin-1). A pasted key that accidentally
 * carries a trailing Korean quote, fullwidth char, or smart quote will make
 * `fetch` throw `String contains non ISO-8859-1 code point` deep inside the
 * request setup — a confusing error surface. Fail fast here instead.
 *
 * @returns the trimmed, validated key
 * @throws LLMError when the key is empty or contains non-ASCII characters
 */
export const validateApiKey = (rawKey: string | undefined, p: ProviderLabel): string => {
  const key = rawKey?.trim() ?? '';
  if (!key) {
    throw new LLMError(`${p.label} API key is required`, { provider: p.id });
  }
  // eslint-disable-next-line no-control-regex
  if (!/^[\x20-\x7e]+$/.test(key)) {
    throw new LLMError(
      `${p.label} API key contains non-ASCII characters — check for pasted smart quotes or hidden whitespace`,
      { provider: p.id },
    );
  }
  return key;
};

/**
 * Guard against empty messages — every provider requires at least one message.
 */
export const assertMessagesNonEmpty = (
  messages: LLMMessage[] | undefined,
  p: ProviderLabel,
): void => {
  if (!messages || messages.length === 0) {
    throw new LLMError('messages must not be empty', { provider: p.id });
  }
};

/**
 * POST to an LLM endpoint and return parsed JSON.
 *
 * Normalizes three failure modes into `LLMError`:
 *   1. fetch throws (network error, AbortError, bad headers)
 *   2. non-ok HTTP status → `${label} ${status}: ${detail}`
 *   3. body is not JSON → `${label} returned a non-JSON response`
 *
 * The caller owns the response shape: this function returns `unknown` and the
 * caller narrows/parses provider-specific fields.
 */
export const fetchLLM = async (
  url: string,
  init: RequestInit,
  p: ProviderLabel,
): Promise<unknown> => {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err: unknown) {
    throw new LLMError(
      `${p.label} request failed: ${err instanceof Error ? err.message : String(err)}`,
      { provider: p.id },
    );
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response — fall through */
  }

  if (!res.ok) {
    const detail =
      (json as { error?: { message?: string } } | null)?.error?.message ?? res.statusText;
    throw new LLMError(`${p.label} ${res.status}: ${detail}`, {
      status: res.status,
      provider: p.id,
    });
  }
  if (json === null) {
    throw new LLMError(`${p.label} returned a non-JSON response`, {
      status: res.status,
      provider: p.id,
    });
  }

  return json;
};
