/**
 * Shared encar URL helpers.
 * Consolidates car-id extraction and detail-page detection regexes.
 */

export const CAR_DETAIL_RE = /\/cars\/detail\/(\d+)/;
export const ENCAR_DETAIL_URL_RE = /^https:\/\/fem\.encar\.com\/cars\/detail\//;

export const extractCarId = (url: string | undefined): string | null => {
  if (!url) return null;
  return CAR_DETAIL_RE.exec(url)?.[1] ?? null;
};

export const isEncarDetail = (url: string | undefined): boolean =>
  !!url && ENCAR_DETAIL_URL_RE.test(url);
