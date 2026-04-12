// src/sidepanel/lib/format.ts

export const fmtMileage = (km: number | null): string =>
  km === null ? '—' : km >= 10000 ? `${(km / 10000).toFixed(1)}만km` : `${km.toLocaleString()}km`;

export const fmtPrice = (won: number | null): string =>
  won === null ? '—' : `${won.toLocaleString()}만원`;
