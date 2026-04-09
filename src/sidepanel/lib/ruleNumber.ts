export function ruleNumber(ruleId: string): string {
  const match = ruleId.match(/\d+/);
  if (!match) return '??';
  return String(Number(match[0])).padStart(2, '0');
}
