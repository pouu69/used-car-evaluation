import React from 'react';

interface ActionBarProps {
  onRefresh: () => void;
  onGoToAi: () => void;
  saved: boolean;
  onToggleSave: () => void;
}

export const css: string = `
.ab-root {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-top: 4px double #000;
}

.ab-btn {
  padding: 14px;
  font-family: 'Archivo Black', sans-serif;
  font-size: 13px;
  letter-spacing: -0.2px;
  text-align: center;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
}

.ab-btn--refresh {
  background: #fff;
  color: #000;
  border-right: 2px solid #000;
}

.ab-btn--save {
  background: #fff;
  color: #000;
  border-right: 2px solid #000;
}

.ab-btn--save[data-saved='true'] {
  background: #CCFF00;
  color: #000;
}

.ab-btn--ai {
  background: #000;
  color: #fff;
}
`;

export const ActionBar: React.FC<ActionBarProps> = ({
  onRefresh,
  onGoToAi,
  saved,
  onToggleSave,
}) => (
  <div className="ab-root">
    <button className="ab-btn ab-btn--refresh" onClick={onRefresh}>
      ↻ 재평가
    </button>
    <button
      className="ab-btn ab-btn--save"
      data-saved={saved}
      onClick={onToggleSave}
    >
      {saved ? '★ SAVED' : '☆ SAVE'}
    </button>
    <button className="ab-btn ab-btn--ai" onClick={onGoToAi}>
      AI 평가 →
    </button>
  </div>
);
