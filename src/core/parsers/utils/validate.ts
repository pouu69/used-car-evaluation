/**
 * Validation helpers shared across parsers. Deterministic, AI-free.
 */

/**
 * Strict plain-object check: excludes null and arrays.
 * Use when the caller needs a keyed record and arrays would be invalid input.
 */
export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Loose object-like check: matches the historical
 * `!json || typeof json !== 'object'` guard that does NOT exclude arrays.
 * Use when replacing such inline guards to preserve exact semantics.
 */
export const isObjectLike = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;
