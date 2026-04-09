/**
 * Brutalist Scoreboard theme — colors, fonts, keyframes.
 * Consumed by every component via a shared <style> injection in App.tsx.
 */

export const COLORS = {
  black: '#000000',
  white: '#ffffff',
  yellow: '#e4ff00',
  red: '#ff2d4b',
  gray: '#f0f0f0',
  grayFaint: '#fafafa',
} as const;

export const FONTS = {
  display: "'Archivo Black', sans-serif",
  mono: "'Space Mono', monospace",
  body: "'Inter Tight', sans-serif",
} as const;

export const GOOGLE_FONTS_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&family=Inter+Tight:wght@400;600;700;800&display=swap');`;

/**
 * Shared container styles for standalone state views
 * (EmptyState / LoadingView / ErrorView). Callers compose this into their
 * own CSS strings under a component-scoped class selector.
 */
export const STATE_CONTAINER_CSS = `
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
  border: 4px solid ${COLORS.black};
  margin: 20px;
  background: ${COLORS.white};
  text-align: center;
`;

export const globalCss = `
${GOOGLE_FONTS_IMPORT}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${COLORS.white}; color: ${COLORS.black}; font-family: ${FONTS.body}; }

@keyframes autoverdict-radar-draw {
  from { stroke-dashoffset: 2000; }
  to { stroke-dashoffset: 0; }
}

@keyframes autoverdict-stagger-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes autoverdict-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

button { font-family: inherit; }
button:focus-visible { outline: 3px solid ${COLORS.yellow}; outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
`;
