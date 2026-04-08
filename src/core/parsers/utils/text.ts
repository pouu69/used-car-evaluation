/**
 * Text/regex helpers shared across parsers. AI-free, deterministic.
 */

export const splitLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

export const wonToNumber = (raw: string): number | undefined => {
  // "3만원" → 30000, "1,234,567원" → 1234567, "8,977,290원" → 8977290
  const trimmed = raw.replace(/\s/g, '');
  const manMatch = /^([\d,]+)만원$/.exec(trimmed);
  if (manMatch && manMatch[1]) {
    const n = Number(manMatch[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n * 10_000 : undefined;
  }
  const wonMatch = /^([\d,]+)원$/.exec(trimmed);
  if (wonMatch && wonMatch[1]) {
    const n = Number(wonMatch[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

export const findFirst = <T>(
  items: T[],
  pred: (item: T) => boolean,
): T | undefined => items.find(pred);
