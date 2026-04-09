/**
 * Shared CSS for the AI evaluation panel subcomponents.
 * Exported as a single string so the parent can inject it
 * via a <style> tag (keeping parity with the previous export).
 */
export const aiPanelCss: string = `
.ai-root {
  background: #fff;
  color: #000;
  border-bottom: 4px solid #000;
  animation: autoverdict-fade 260ms ease-out both;
}

.ai-header {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #000;
  color: #fff;
  padding: 10px 14px;
  border-bottom: 4px solid #000;
}
.ai-header-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  letter-spacing: -0.2px;
  text-transform: uppercase;
}
.ai-header-note {
  margin-left: auto;
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 2px;
  text-transform: uppercase;
  opacity: 0.7;
}

.ai-section {
  padding: 12px 14px;
  border-bottom: 2px solid #000;
}

.ai-provider {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border: 2px solid #000;
}
.ai-provider-btn {
  background: #fff;
  color: #000;
  border: none;
  border-right: 2px solid #000;
  padding: 10px 8px;
  cursor: pointer;
  font-family: 'Archivo Black', sans-serif;
  font-size: 11px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  text-align: left;
}
.ai-provider-btn:last-child { border-right: none; }
.ai-provider-btn--active {
  background: #000;
  color: #fff;
}
.ai-provider-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.ai-provider-sub {
  display: block;
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 1px;
  margin-top: 3px;
  opacity: 0.65;
}

.ai-key-row {
  display: flex;
  gap: 0;
  margin-top: 10px;
  border: 2px solid #000;
}
.ai-key-input {
  flex: 1;
  background: #fff;
  color: #000;
  border: none;
  padding: 10px 12px;
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  outline: none;
}
.ai-key-input::placeholder {
  color: #000;
  opacity: 0.35;
}
.ai-key-input:disabled { background: #fafafa; cursor: not-allowed; }
.ai-key-toggle {
  background: #fff;
  color: #000;
  border: none;
  border-left: 2px solid #000;
  padding: 0 14px;
  cursor: pointer;
  font-family: 'Archivo Black', sans-serif;
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.ai-key-toggle:disabled { cursor: not-allowed; opacity: 0.5; }

.ai-run-row { display: flex; gap: 8px; margin-top: 10px; }
.ai-run-btn {
  flex: 1;
  background: #e4ff00;
  color: #000;
  border: 2px solid #000;
  padding: 12px 14px;
  cursor: pointer;
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  letter-spacing: -0.2px;
  text-transform: uppercase;
  transition: transform 120ms ease-out;
}
.ai-run-btn:hover:not(:disabled) { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 #000; }
.ai-run-btn:disabled {
  background: #f0f0f0;
  color: #000;
  cursor: not-allowed;
  opacity: 0.5;
}
.ai-cancel-btn {
  background: #fff;
  color: #000;
  border: 2px solid #000;
  padding: 12px 14px;
  cursor: pointer;
  font-family: 'Archivo Black', sans-serif;
  font-size: 11px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.ai-hint {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  line-height: 1.6;
  margin-top: 10px;
  opacity: 0.7;
}

.ai-error {
  background: #ff2d4b;
  color: #fff;
  border-bottom: 4px solid #000;
  padding: 12px 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.ai-error-mark {
  font-family: 'Archivo Black', sans-serif;
  font-size: 22px;
  line-height: 1;
}
.ai-error-text {
  font-family: 'Inter Tight', sans-serif;
  font-size: 12px;
  line-height: 1.5;
  font-weight: 600;
}

.ai-loading {
  padding: 28px 14px;
  text-align: center;
  border-bottom: 4px solid #000;
  background: #e4ff00;
}
.ai-loading-text {
  font-family: 'Archivo Black', sans-serif;
  font-size: 36px;
  letter-spacing: -1px;
  line-height: 0.9;
}
.ai-loading-sub {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-top: 8px;
  opacity: 0.7;
}

.ai-verdict {
  padding: 14px;
  border-bottom: 4px solid #000;
}
.ai-verdict--buy       { background: #7cff6b; }
.ai-verdict--negotiate { background: #e4ff00; }
.ai-verdict--avoid     { background: #ff2d4b; color: #fff; }
.ai-verdict--unknown   { background: #d4d4d4; }
.ai-verdict-tag {
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 2px;
  text-transform: uppercase;
}
.ai-verdict-label {
  font-family: 'Archivo Black', sans-serif;
  font-size: 32px;
  line-height: 0.95;
  letter-spacing: -1px;
  text-transform: uppercase;
  margin-top: 6px;
}
.ai-verdict-risk {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.5px;
  margin-top: 8px;
  border-top: 2px solid currentColor;
  padding-top: 6px;
}

.ai-summary {
  padding: 14px;
  border-bottom: 2px solid #000;
  font-family: 'Inter Tight', sans-serif;
  font-size: 13px;
  line-height: 1.6;
  font-weight: 500;
}

.ai-section-head {
  background: #000;
  color: #fff;
  padding: 6px 14px;
  font-family: 'Archivo Black', sans-serif;
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ai-section-count {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  opacity: 0.7;
}

.ai-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.ai-list-item {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #000;
  font-family: 'Inter Tight', sans-serif;
  font-size: 12px;
  line-height: 1.5;
}
.ai-list-mark {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
}
.ai-list-item--strength { background: #fff; }
.ai-list-item--neg { background: #fafafa; }
.ai-list-item--data { background: #f0f0f0; }

.ai-concern {
  padding: 10px 14px;
  border-bottom: 1px solid #000;
  border-left: 8px solid #000;
}
.ai-concern--low      { border-left-color: #7cff6b; }
.ai-concern--medium   { border-left-color: #e4ff00; }
.ai-concern--high     { border-left-color: #ff8f1f; background: #fff8ec; }
.ai-concern--critical { border-left-color: #ff2d4b; background: #fff0f2; }
.ai-concern-head {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.ai-concern-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: -0.1px;
}
.ai-concern-sev {
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 1px;
  padding: 2px 6px;
  border: 1px solid #000;
  text-transform: uppercase;
}
.ai-concern-sev--low      { background: #7cff6b; }
.ai-concern-sev--medium   { background: #e4ff00; }
.ai-concern-sev--high     { background: #ff8f1f; color: #000; }
.ai-concern-sev--critical { background: #ff2d4b; color: #fff; }
.ai-concern-rules {
  margin-left: auto;
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.5px;
  opacity: 0.6;
}
.ai-concern-detail {
  font-family: 'Inter Tight', sans-serif;
  font-size: 11px;
  line-height: 1.5;
  margin-top: 5px;
}

.ai-footer {
  padding: 8px 14px;
  background: #fafafa;
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 1px;
  text-transform: uppercase;
  text-align: right;
  opacity: 0.6;
}
`;

export interface VerdictMeta {
  cls: string;
  label: string;
}

export interface ProviderMeta {
  main: string;
  sub: string;
}
