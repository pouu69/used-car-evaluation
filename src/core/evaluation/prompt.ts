/**
 * LLM에 넘길 system / user 프롬프트 빌더.
 *
 * 비용 최적화 설계:
 *  - INPUT 절감: compact context. null/undefined 제거, report.passes 제거
 *    (LLM에게 불필요), 중복 필드(title vs message) 제거, 문자열 직렬화는
 *    pretty-print 없이 한 줄로.
 *  - OUTPUT 절감: 하드 길이 제한을 길이가 가치를 만드는 섹션에만 넉넉하게
 *    주고, 단순 불릿은 짧게. 전체 출력 예산 ≈ 1000~1400 tokens.
 *  - 환각 방지: 룰 엔진 결과(killers/warns/unknowns)를 그대로 넘긴다.
 */
import type { FieldStatus } from '../types/FieldStatus.js';
import type { ChecklistFacts } from '../types/ChecklistFacts.js';
import type { RuleReport, RuleResult } from '../types/RuleTypes.js';
import type { EncarCarBase } from '../types/ParsedData.js';
import type { EvaluationInput } from './types.js';
import { formatYearMonth } from '../parsers/utils/text.js';

// ---------- system prompt ----------

export const EVALUATION_SYSTEM_PROMPT = `당신은 엔카 중고차 베테랑 컨설턴트다. 룰 엔진 결과를 반영해 실전 조치를 짧게 쓴다.

원칙:
- killers/warns 는 희석 금지. unknown/hidden 추측 금지 → dataQualityWarnings.
- 원본에 없는 수치는 지어내지 않는다.

길이 규칙 (엄수):
- summary: **1~2문장, 120자 이내**. 결론 + 핵심 이유만.
- strengths: 최대 3개, 각 20자 이내, 명사구.
- concerns: 2~3개. title 15자 이내, detail 1문장 60자 이내.
- negotiationPoints: 3~4개, 각 40~70자. 실행 가능한 문장만. "확인하세요" 금지. 다음 중에서 섞어쓴다:
  · 문서 요구 (예: "카히스토리 출력본 요구")
  · 현장 점검 (예: "하체 리프트 후 프레임 용접 확인")
  · 가격 협상 (예: "누적 수리 180만 근거로 100만 인하 요구")
  · 계약 특약 (예: "인수 후 14일 내 중대결함 환불 특약")
- dataQualityWarnings: 최대 3개, 15자 이내. "OO 미공개" 형식.
- 모든 리스트 중요도 내림차순. 중복 통합.
- 금지어: "것으로 보입니다", "할 수 있습니다", "전반적으로", "편입니다".

출력:
- JSON 객체 하나만. 코드블록/설명/주석 금지.
- 한국어. 수치는 원문 단위(만원/km/회).
- severity: low | medium | high | critical
- verdict: BUY | NEGOTIATE | AVOID | UNKNOWN
- overallRisk: low | medium | high | critical

스키마:
{"verdict":"...","overallRisk":"...","summary":"...","strengths":[],"concerns":[{"title":"...","severity":"...","detail":"...","evidenceRuleIds":[]}],"negotiationPoints":[],"dataQualityWarnings":[]}`;

// ---------- helpers ----------

const unwrap = <T>(f: FieldStatus<T> | undefined): T | null => {
  if (!f) return null;
  return f.kind === 'value' ? f.value : null;
};

const wonToManwon = (won: number | null | undefined): number | null =>
  typeof won === 'number' && Number.isFinite(won) ? Math.round(won / 10_000) : null;

const formatPriceMan = (man: number | null): string | null => {
  if (man === null) return null;
  if (man >= 10_000) {
    const eok = Math.floor(man / 10_000);
    const rest = man % 10_000;
    return rest > 0 ? `${eok}억${rest}만` : `${eok}억`;
  }
  return `${man}만`;
};

/** 차량을 한 줄 문자열로 직렬화. 토큰 최소. */
const buildCarLine = (base: EncarCarBase | null): string => {
  if (!base) return '알 수 없음';
  const parts: string[] = [];
  const name = [base.category.manufacturerName, base.category.modelName]
    .filter(Boolean)
    .join(' ');
  if (name) parts.push(name);
  const grade = base.category.gradeDetailName ?? base.category.gradeName;
  if (grade) parts.push(grade);
  const ym = formatYearMonth(base.category.yearMonth);
  if (ym) parts.push(ym);
  if (base.spec.mileage !== undefined) {
    parts.push(`${base.spec.mileage.toLocaleString()}km`);
  }
  if (base.spec.fuelName) parts.push(base.spec.fuelName);
  if (base.spec.transmissionName) parts.push(base.spec.transmissionName);

  const priceMan = wonToManwon(base.advertisement.price);
  const newPriceMan = wonToManwon(base.category.newPrice);
  const priceStr = formatPriceMan(priceMan);
  const newStr = formatPriceMan(newPriceMan);
  if (priceStr) {
    parts.push(newStr ? `${priceStr}(신차 ${newStr})` : priceStr);
  }
  return parts.join('·');
};

/** 단일 fact를 '값' 또는 상태 태그 하나로 축약. */
interface CompactFact {
  status: 'known' | 'hidden' | 'failed' | 'pending';
  value?: unknown;
  reason?: string;
}

const compactField = <T>(f: FieldStatus<T>): CompactFact => {
  switch (f.kind) {
    case 'value':
      return { status: 'known', value: f.value };
    case 'hidden_by_dealer':
      return { status: 'hidden' };
    case 'parse_failed':
      return { status: 'failed', reason: f.reason };
    case 'loading':
    case 'timeout':
      return { status: 'pending' };
  }
};

/** known인 필드만 값 객체, 나머지는 필드명을 unknown 배열로. */
const splitFacts = (
  facts: ChecklistFacts,
): { known: Record<string, unknown>; unknown: string[]; hidden: string[] } => {
  const known: Record<string, unknown> = {};
  const unknown: string[] = [];
  const hidden: string[] = [];
  const entries: Array<[string, FieldStatus<unknown>]> = [
    ['insuranceHistoryDisclosed', facts.insuranceHistoryDisclosed],
    ['inspectionReportDisclosed', facts.inspectionReportDisclosed],
    ['hasEncarDiagnosis', facts.hasEncarDiagnosis],
    ['frameDamage', facts.frameDamage],
    ['usageHistory', facts.usageHistory],
    ['totalLossHistory', facts.totalLossHistory],
    ['ownerChangeCount', facts.ownerChangeCount],
    ['insuranceGap', facts.insuranceGap],
    ['unconfirmedAccident', facts.unconfirmedAccident],
    ['minorAccidents', facts.minorAccidents],
    ['priceVsMarket', facts.priceVsMarket],
  ];
  for (const [key, f] of entries) {
    const c = compactField(f);
    if (c.status === 'known') known[key] = c.value;
    else if (c.status === 'hidden') hidden.push(key);
    else unknown.push(key);
  }
  return { known, unknown, hidden };
};

const trimRule = (r: RuleResult): { id: string; msg: string } => ({
  id: r.ruleId,
  msg: r.message,
});

// ---------- compact context ----------

export interface CompactEvaluationContext {
  car: string;
  preVerified: boolean | null;
  verdict: string;
  killers: Array<{ id: string; msg: string }>;
  warns: Array<{ id: string; msg: string }>;
  facts: Record<string, unknown>;
  unknown: string[];
  hidden?: string[];
  bridgeWarnings?: string[];
}

export const buildEvaluationContext = (
  input: EvaluationInput,
): CompactEvaluationContext => {
  const base = unwrap(input.parsed.raw.base);
  const split = splitFacts(input.facts);
  const ctx: CompactEvaluationContext = {
    car: buildCarLine(base),
    preVerified: base?.advertisement.preVerified ?? null,
    verdict: input.report.verdict,
    killers: input.report.killers.map(trimRule),
    warns: input.report.warns.map(trimRule),
    facts: split.known,
    unknown: split.unknown,
  };
  if (split.hidden.length > 0) ctx.hidden = split.hidden;
  if (input.facts.bridgeWarnings.length > 0) {
    ctx.bridgeWarnings = input.facts.bridgeWarnings;
  }
  return ctx;
};

// ---------- user prompt ----------

export const buildEvaluationUserPrompt = (input: EvaluationInput): string => {
  const ctx = buildEvaluationContext(input);
  return [
    '엔카 매물을 평가. 시스템 프롬프트의 길이 규칙 준수. JSON 객체 하나만.',
    '',
    `[차량] ${ctx.car}`,
    `[preVerified] ${ctx.preVerified ?? 'unknown'}`,
    `[룰엔진 verdict] ${ctx.verdict}`,
    `[killers] ${JSON.stringify(ctx.killers)}`,
    `[warns] ${JSON.stringify(ctx.warns)}`,
    `[known facts] ${JSON.stringify(ctx.facts)}`,
    `[unknown fields] ${ctx.unknown.join(', ') || '(없음)'}`,
    ctx.hidden ? `[hidden by dealer] ${ctx.hidden.join(', ')}` : '',
    ctx.bridgeWarnings ? `[bridge warnings] ${ctx.bridgeWarnings.join('; ')}` : '',
    '',
    '판정:',
    '- killers≥1 → AVOID',
    '- warns만 → NEGOTIATE',
    '- 깨끗하고 known 충분 → BUY',
    '- known<50% → UNKNOWN',
    '',
    '특히 negotiationPoints는 딜러와 실제로 말할 수 있는 구체적 문장으로. 단순 "확인하세요" 금지.',
  ]
    .filter((line) => line !== '')
    .join('\n');
};

export const buildEvaluationPrompts = (
  input: EvaluationInput,
): { system: string; user: string } => ({
  system: EVALUATION_SYSTEM_PROMPT,
  user: buildEvaluationUserPrompt(input),
});
