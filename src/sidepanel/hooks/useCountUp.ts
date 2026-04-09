import { useState, useEffect } from 'react';

/**
 * Animates a number from 0 to `target` over `durationMs` using ease-out cubic.
 * Returns Math.round(current).
 * Respects prefers-reduced-motion: skips animation and returns target immediately.
 */
export function useCountUp(target: number, durationMs: number = 600): number {
  const [current, setCurrent] = useState<number>(target);

  useEffect(() => {
    // Guard SSR
    if (typeof window === 'undefined') {
      setCurrent(target);
      return;
    }

    // Respect reduced-motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCurrent(target);
      return;
    }

    setCurrent(0);

    let rafId: number;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic: t → 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(Math.round(eased * target));

      if (t < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [target, durationMs]);

  return Math.round(current);
}
