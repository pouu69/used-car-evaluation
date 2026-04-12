import React from 'react';

interface SaveButtonProps {
  saved: boolean;
  onToggle: () => void;
}

export const css: string = `
.save-bar {
  display: flex;
  justify-content: center;
  border-bottom: 4px solid #000;
}
.save-bar-btn {
  width: 100%;
  padding: 12px;
  font-family: 'Archivo Black', sans-serif;
  font-size: 13px;
  letter-spacing: 0.5px;
  text-align: center;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}
.save-bar-btn--unsaved {
  background: #fff;
  color: #000;
}
.save-bar-btn--unsaved:hover {
  background: #f0f0f0;
}
.save-bar-btn--saved {
  background: #CCFF00;
  color: #000;
}
`;

export const SaveButton: React.FC<SaveButtonProps> = ({ saved, onToggle }) => (
  <div className="save-bar">
    <button
      className={`save-bar-btn ${saved ? 'save-bar-btn--saved' : 'save-bar-btn--unsaved'}`}
      onClick={onToggle}
    >
      {saved ? '★ SAVED' : '☆ SAVE'}
    </button>
  </div>
);
