import React from 'react';

interface ErrorViewProps {
  reason: string;
  onRetry: () => void;
}

export const css = `
.ev-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
  border: 4px solid #000;
  margin: 20px;
  background: #fff;
  text-align: center;
}
.ev-dot {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 16px;
  height: 16px;
  background: #ff2d4b;
  border: 3px solid #000;
}
.ev-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 64px;
  line-height: 0.85;
  letter-spacing: -2px;
  color: #000;
}
.ev-reason {
  font-family: 'Inter Tight', sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: #000;
}
.ev-btn {
  font-family: 'Archivo Black', sans-serif;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: -0.3px;
  background: #e4ff00;
  color: #000;
  border: 4px solid #000;
  padding: 10px 20px;
  cursor: pointer;
}
`;

export const ErrorView: React.FC<ErrorViewProps> = ({ reason, onRetry }) => {
  const reasonText =
    reason === 'watchdog_timeout'
      ? '엔카 응답이 22초 내에 오지 않았어요. 잠시 후 다시 시도해 주세요.'
      : reason;

  return (
    <div className="ev-container">
      <div className="ev-dot" />
      <div className="ev-title">ERROR</div>
      <div className="ev-reason">{reasonText}</div>
      <button className="ev-btn" onClick={onRetry}>
        ↻ RETRY
      </button>
    </div>
  );
};
