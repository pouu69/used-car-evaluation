/**
 * Percent / health helpers for the sidepanel.
 *
 * `passRatio` returns an integer 0-100 representing pass-rate.
 * `getHealthLevel` buckets that ratio into a three-tier health indicator
 * shared by the health radar and rule group count badges.
 */

export const passRatio = (pass: number, total: number): number =>
  total <= 0 ? 0 : Math.round((pass / total) * 100);

export type HealthLevel = 'good' | 'warn' | 'bad';

export const getHealthLevel = (ratio: number): HealthLevel => {
  if (ratio >= 80) return 'good';
  if (ratio >= 50) return 'warn';
  return 'bad';
};
