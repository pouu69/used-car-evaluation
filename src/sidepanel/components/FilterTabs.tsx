import React from 'react';

export type Filter = 'all' | 'fatal' | 'warn' | 'pass' | 'na';

interface FilterTabsProps {
  counts: {
    total: number;
    killers: number;
    warns: number;
    passes: number;
    unknowns: number;
  };
  active: Filter;
  onChange: (f: Filter) => void;
}

export const css: string = `
  .autoverdict-filter-tabs {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    border-bottom: 4px solid #000;
  }
  .v-tab {
    padding: 12px 2px 10px;
    border-right: 2px solid #000;
    border-top: none;
    border-left: none;
    border-bottom: none;
    text-align: center;
    cursor: pointer;
    position: relative;
    font-family: inherit;
    background: #fff;
    color: #000;
  }
  .v-tab:last-child {
    border-right: none;
  }
  .v-tab::before {
    content: '';
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    height: 5px;
    background: transparent;
  }
  .v-tab.is-active::before {
    background: #000;
  }
  .v-tab-all {
    background: #000;
    color: #fff;
  }
  .v-tab-all.is-active::before {
    background: #e4ff00;
  }
  .v-tab-fatal {
    background: #ff2d4b;
    color: #fff;
  }
  .v-tab-warn {
    background: #e4ff00;
    color: #000;
  }
  .v-tab-pass {
    background: #fff;
    color: #000;
  }
  .v-tab-na {
    background: #f0f0f0;
    color: #000;
  }
  .v-tab-count {
    display: block;
    font-family: 'Archivo Black', sans-serif;
    font-size: 28px;
    line-height: 1;
    letter-spacing: -1px;
  }
  .v-tab-label {
    display: block;
    font-family: 'Space Mono', monospace;
    font-size: 8px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    margin-top: 5px;
    opacity: 0.75;
  }
`;

interface TabDef {
  id: Filter;
  count: number;
  label: string;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({ counts, active, onChange }) => {
  const tabs: TabDef[] = [
    { id: 'all',   count: counts.total,    label: 'All'   },
    { id: 'fatal', count: counts.killers,  label: 'Fatal' },
    { id: 'warn',  count: counts.warns,    label: 'Warn'  },
    { id: 'pass',  count: counts.passes,   label: 'Pass'  },
    { id: 'na',    count: counts.unknowns, label: 'N/A'   },
  ];

  return (
    <div className="autoverdict-filter-tabs">
      {tabs.map(({ id, count, label }) => (
        <button
          key={id}
          className={`v-tab v-tab-${id}${active === id ? ' is-active' : ''}`}
          onClick={() => onChange(id)}
          type="button"
        >
          <span className="v-tab-count">{count}</span>
          <span className="v-tab-label">{label}</span>
        </button>
      ))}
    </div>
  );
};
