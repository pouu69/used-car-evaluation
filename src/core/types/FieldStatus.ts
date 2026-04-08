/**
 * FieldStatus<T> — discriminated union for parser output that can be in any of
 * 5 states. Used end-to-end from raw parsing through bridge through rules.
 */
export type FieldStatus<T> =
  | { kind: 'value'; value: T }
  | { kind: 'hidden_by_dealer' }
  | { kind: 'parse_failed'; reason: string }
  | { kind: 'loading' }
  | { kind: 'timeout' };

export const value = <T>(v: T): FieldStatus<T> => ({ kind: 'value', value: v });
export const hidden = <T>(): FieldStatus<T> => ({ kind: 'hidden_by_dealer' });
export const failed = <T>(reason: string): FieldStatus<T> => ({
  kind: 'parse_failed',
  reason,
});
export const loading = <T>(): FieldStatus<T> => ({ kind: 'loading' });
export const timeout = <T>(): FieldStatus<T> => ({ kind: 'timeout' });

export const isValue = <T>(
  s: FieldStatus<T>,
): s is { kind: 'value'; value: T } => s.kind === 'value';

export const mapValue = <T, U>(
  s: FieldStatus<T>,
  fn: (v: T) => U,
): FieldStatus<U> => (s.kind === 'value' ? value(fn(s.value)) : (s as FieldStatus<U>));

export const getOr = <T>(s: FieldStatus<T>, fallback: T): T =>
  s.kind === 'value' ? s.value : fallback;
