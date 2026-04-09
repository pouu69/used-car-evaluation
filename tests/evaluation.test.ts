/**
 * Unit tests for the LLM evaluation layer.
 *
 * Covers:
 *   - Gemini / OpenAI API-key ASCII validation (Latin-1 header guard)
 *   - evaluateCar MAX_TOKENS retry behavior
 *   - evaluateCar JSON + zod schema validation
 *   - prompt builder stability (car line, compact facts split, length)
 */
import { describe, expect, it } from 'vitest';

import { GeminiClient, LLMError, OpenAIClient } from '../src/core/llm/index.js';
import type {
  LLMClient,
  LLMCompletionRequest,
  LLMCompletionResult,
} from '../src/core/llm/index.js';
import { evaluateCar } from '../src/core/evaluation/evaluateCar.js';
import {
  EVALUATION_SYSTEM_PROMPT,
  buildEvaluationContext,
  buildEvaluationPrompts,
} from '../src/core/evaluation/prompt.js';
import { encarToFacts } from '../src/core/bridge/encar-to-facts.js';
import { evaluate } from '../src/core/rules/index.js';
import { sample001, sample007, sampleIdeal } from '../src/__fixtures__/samples.js';

/** A minimal LLMClient stub that lets tests script the exact responses. */
class ScriptedClient implements LLMClient {
  readonly provider = 'scripted';
  calls: LLMCompletionRequest[] = [];
  constructor(
    private readonly responses: Array<
      ((req: LLMCompletionRequest) => LLMCompletionResult) | Error
    >,
  ) {}
  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResult> {
    this.calls.push(req);
    const next = this.responses.shift();
    if (!next) throw new Error('ScriptedClient ran out of responses');
    if (next instanceof Error) throw next;
    return next(req);
  }
}

const validEvaluationJson = JSON.stringify({
  verdict: 'AVOID',
  overallRisk: 'critical',
  summary: '렌트·자차 공백 확인된 매물.',
  strengths: ['보험이력 공개'],
  concerns: [
    {
      title: '렌트 이력',
      severity: 'critical',
      detail: '렌트카 운용 이력 확인.',
      evidenceRuleIds: ['R05'],
    },
  ],
  negotiationPoints: [
    '카히스토리 출력본 요구해 자차 공백 확인',
    '하체 리프트 후 프레임 용접 여부 직접 확인',
    '누적 수리 근거로 가격 인하 요구',
  ],
  dataQualityWarnings: [],
});

const evalInput = (fixture = sample001) => {
  const facts = encarToFacts(fixture);
  const report = evaluate(facts);
  return { parsed: fixture, facts, report };
};

describe('LLM client API-key ASCII validation', () => {
  it('GeminiClient throws on empty key', () => {
    expect(() => new GeminiClient({ apiKey: '   ' })).toThrowError(LLMError);
  });

  it('GeminiClient throws on non-ASCII key (fullwidth quote)', () => {
    // The real-world regression: user pastes a Korean quote mark with the key.
    expect(() => new GeminiClient({ apiKey: 'AIza-abc"키' })).toThrowError(
      /non-ASCII/,
    );
  });

  it('GeminiClient accepts a plain ASCII key', () => {
    expect(
      () => new GeminiClient({ apiKey: 'AIza-abcdef-1234567890' }),
    ).not.toThrow();
  });

  it('OpenAIClient throws on non-ASCII key', () => {
    expect(() => new OpenAIClient({ apiKey: 'sk-abc키' })).toThrowError(
      /non-ASCII/,
    );
  });

  it('OpenAIClient accepts a plain ASCII key', () => {
    expect(
      () => new OpenAIClient({ apiKey: 'sk-proj-abcdef1234' }),
    ).not.toThrow();
  });
});

describe('evaluateCar — response handling', () => {
  it('parses a valid JSON response', async () => {
    const client = new ScriptedClient([
      () => ({ content: validEvaluationJson, model: 'gemini-2.5-flash-lite' }),
    ]);
    const result = await evaluateCar({ client, input: evalInput() });
    expect(result.verdict).toBe('AVOID');
    expect(result.concerns).toHaveLength(1);
    expect(result.concerns[0]?.evidenceRuleIds).toContain('R05');
    expect(result.model).toBe('gemini-2.5-flash-lite');
    expect(result.schemaVersion).toBe(1);
  });

  it('throws LLMError on truncated JSON', async () => {
    const client = new ScriptedClient([
      () => ({
        content: '{"verdict":"AVOID","overallRi',
        model: 'gemini-2.5-flash-lite',
      }),
    ]);
    await expect(evaluateCar({ client, input: evalInput() })).rejects.toThrow(
      /was not valid JSON/,
    );
  });

  it('throws LLMError on schema-invalid JSON', async () => {
    const client = new ScriptedClient([
      () => ({
        content: JSON.stringify({ verdict: 'MAYBE' }),
        model: 'gemini-2.5-flash-lite',
      }),
    ]);
    await expect(evaluateCar({ client, input: evalInput() })).rejects.toThrow(
      /did not match schema/,
    );
  });

  it('retries once with a larger budget when the first call hits MAX_TOKENS', async () => {
    const err = new LLMError(
      'Gemini response truncated (MAX_TOKENS). Try increasing maxTokens.',
      { provider: 'gemini' },
    );
    const client = new ScriptedClient([
      err,
      () => ({ content: validEvaluationJson, model: 'gemini-2.5-flash-lite' }),
    ]);
    const result = await evaluateCar({ client, input: evalInput() });
    expect(result.verdict).toBe('AVOID');
    expect(client.calls).toHaveLength(2);
    // The retry must have used a strictly larger budget than the first call.
    const first = client.calls[0]!;
    const second = client.calls[1]!;
    expect(second.maxTokens ?? 0).toBeGreaterThan(first.maxTokens ?? 0);
  });

  it('does NOT retry when caller passed an explicit maxTokens', async () => {
    const err = new LLMError(
      'Gemini response truncated (MAX_TOKENS). Try increasing maxTokens.',
      { provider: 'gemini' },
    );
    const client = new ScriptedClient([err]);
    await expect(
      evaluateCar({ client, input: evalInput(), maxTokens: 512 }),
    ).rejects.toThrow(/MAX_TOKENS/);
    expect(client.calls).toHaveLength(1);
  });

  it('propagates non-MAX_TOKENS errors without retrying', async () => {
    const err = new LLMError('Gemini 429: rate limited', {
      provider: 'gemini',
    });
    const client = new ScriptedClient([err]);
    await expect(evaluateCar({ client, input: evalInput() })).rejects.toThrow(
      /429/,
    );
    expect(client.calls).toHaveLength(1);
  });
});

describe('prompt builder', () => {
  it('buildEvaluationContext car line has brand + model + year + mileage', () => {
    const ctx = buildEvaluationContext(evalInput(sample001));
    expect(ctx.car).toContain('기아');
    expect(ctx.car).toContain('스포티지');
    expect(ctx.car).toContain('2021.11');
    expect(ctx.car).toContain('km');
  });

  it('buildEvaluationContext surfaces killers + bridge warnings', () => {
    const ctx = buildEvaluationContext(evalInput(sample007));
    expect(ctx.killers.length).toBeGreaterThanOrEqual(2);
    // R03 is now bonus-only — absence should NOT appear as a killer id.
    expect(ctx.killers.map((k) => k.id)).not.toContain('R03');
    expect(ctx.verdict).toBe('NEVER');
    // The inspection-sourced frame warning must flow through to the LLM.
    expect(ctx.bridgeWarnings).toContain(
      'frameDamage_from_inspection_simpleRepair',
    );
  });

  it('tightened system prompt is under ~1200 characters (token cost guard)', () => {
    // Locks in the verbosity cut. If someone expands the prompt beyond this,
    // the test forces them to consciously bump the ceiling.
    expect(EVALUATION_SYSTEM_PROMPT.length).toBeLessThan(1200);
  });

  it('buildEvaluationPrompts returns both system + user sections', () => {
    const { system, user } = buildEvaluationPrompts(evalInput(sampleIdeal));
    expect(system).toBe(EVALUATION_SYSTEM_PROMPT);
    expect(user).toContain('[차량]');
    expect(user).toContain('[룰엔진 verdict]');
  });
});
