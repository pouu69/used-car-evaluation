/**
 * S1 — Extract `__PRELOADED_STATE__.cars.base` and detail flags.
 *
 * Input: a window-like object (with `__PRELOADED_STATE__`).
 * In production this comes from `window`. In tests we pass a fixture.
 */
import type { EncarCarBase, DetailFlags } from '../../types/ParsedData.js';
import type { FieldStatus } from '../../types/FieldStatus.js';
import { failed, value } from '../../types/FieldStatus.js';

export interface PreloadedRoot {
  __PRELOADED_STATE__?: {
    cars?: {
      base?: unknown;
      detailFlags?: unknown;
    };
  };
  // Fallback: Next.js hydration — used if Encar migrates away from the
  // reduxy `__PRELOADED_STATE__` blob on the detail page.
  __NEXT_DATA__?: {
    props?: {
      pageProps?: {
        cars?: { base?: unknown; detailFlags?: unknown };
        base?: unknown;
        detailFlags?: unknown;
      };
    };
  };
}

const deepFind = (obj: unknown, key: string, depth = 6): unknown => {
  if (depth <= 0 || !obj || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
  if (key in o) return o[key];
  for (const v of Object.values(o)) {
    const hit = deepFind(v, key, depth - 1);
    if (hit !== undefined) return hit;
  }
  return undefined;
};

export const extractBase = (
  root: PreloadedRoot,
): FieldStatus<EncarCarBase> => {
  const primary = root.__PRELOADED_STATE__?.cars?.base;
  if (primary && typeof primary === 'object') {
    return value(primary as EncarCarBase);
  }
  const pp = root.__NEXT_DATA__?.props?.pageProps;
  const fromNext =
    (pp as { cars?: { base?: unknown } } | undefined)?.cars?.base ??
    (pp as { base?: unknown } | undefined)?.base ??
    deepFind(root.__NEXT_DATA__, 'base');
  if (fromNext && typeof fromNext === 'object') {
    return value(fromNext as EncarCarBase);
  }
  return failed('preloaded_state_missing');
};

export const extractDetailFlags = (
  root: PreloadedRoot,
): FieldStatus<DetailFlags> => {
  const primary = root.__PRELOADED_STATE__?.cars?.detailFlags;
  if (primary && typeof primary === 'object') {
    return value(primary as DetailFlags);
  }
  const pp = root.__NEXT_DATA__?.props?.pageProps;
  const fromNext =
    (pp as { cars?: { detailFlags?: unknown } } | undefined)?.cars
      ?.detailFlags ??
    (pp as { detailFlags?: unknown } | undefined)?.detailFlags ??
    deepFind(root.__NEXT_DATA__, 'detailFlags');
  if (fromNext && typeof fromNext === 'object') {
    return value(fromNext as DetailFlags);
  }
  return failed('detail_flags_missing');
};
