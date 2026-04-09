/// <reference types="vite/client" />
/**
 * Dev-only namespaced logger. In production (import.meta.env.PROD true) all
 * methods are no-ops so bundler can tree-shake them away. `error` still logs
 * in production — genuine errors should always surface.
 *
 * Safe in any bundling context (content script MAIN world, background worker,
 * sidepanel). If `import.meta.env` is unavailable we fall back to no-ops.
 */
const isDev = (() => {
  try {
    return import.meta.env?.DEV === true;
  } catch {
    return false;
  }
})();

export interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export const createLogger = (namespace: string): Logger => {
  const prefix = `[${namespace}]`;
  if (!isDev) {
    const noop = () => {};
    return {
      log: noop,
      warn: noop,
      error: (...args) => console.error(prefix, ...args),
    };
  }
  return {
    log: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
};
