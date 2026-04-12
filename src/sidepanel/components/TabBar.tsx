import React from 'react';

export type Tab = 'checklist' | 'ai' | 'mylist';

interface TabBarProps {
  tab: Tab;
  onChange: (t: Tab) => void;
  disabledTabs?: Tab[];
}

const TABS: Array<{ id: Tab; label: string; sub: string }> = [
  { id: 'checklist', label: 'CHECKLIST', sub: '◼ 11 RULES' },
  { id: 'ai', label: 'AI REVIEW', sub: '◇ GEMINI / GPT' },
  { id: 'mylist', label: 'MY LIST', sub: '★ SAVED CARS' },
];

export const css: string = `
.tab-bar {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-bottom: 4px solid #000;
}
.tab-bar-btn {
  padding: 14px 8px 12px;
  border: none;
  border-right: 4px solid #000;
  cursor: pointer;
  text-align: center;
  font-family: 'Archivo Black', sans-serif;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: -0.3px;
}
.tab-bar-btn:last-child {
  border-right: none;
}
.tab-bar-btn--active {
  background: #000;
  color: #fff;
}
.tab-bar-btn--inactive {
  background: #fff;
  color: #000;
}
.tab-bar-sub {
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 1.5px;
  display: block;
  margin-top: 4px;
  font-weight: 700;
}
.tab-bar-btn--active .tab-bar-sub {
  opacity: 0.75;
}
.tab-bar-btn--inactive .tab-bar-sub {
  opacity: 0.6;
}
.tab-bar-btn--disabled {
  background: #e0e0e0;
  color: #999;
  cursor: not-allowed;
}
.tab-bar-btn--disabled .tab-bar-sub {
  opacity: 0.4;
}
`;

export const TabBar: React.FC<TabBarProps> = ({ tab, onChange, disabledTabs = [] }) => (
  <div className="tab-bar">
    {TABS.map((t) => {
      const active = tab === t.id;
      const disabled = disabledTabs.includes(t.id);
      const cls = disabled
        ? 'tab-bar-btn tab-bar-btn--disabled'
        : `tab-bar-btn ${active ? 'tab-bar-btn--active' : 'tab-bar-btn--inactive'}`;
      return (
        <button
          key={t.id}
          className={cls}
          disabled={disabled}
          onClick={() => !disabled && onChange(t.id)}
        >
          {t.label}
          <span className="tab-bar-sub">{t.sub}</span>
        </button>
      );
    })}
  </div>
);
