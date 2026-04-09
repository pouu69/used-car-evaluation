import React, { useEffect, useState } from 'react';

interface LoadingViewProps {
  stage: string | null;
  carId?: string;
  onRefresh: () => void;
}

const STAGE_LABEL: Record<string, string> = {
  start: '평가를 시작합니다...',
  fetching_reports: '이력·진단·사고 리포트 수집 중...',
};

export const css = `
.lv-container {
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
.lv-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 64px;
  line-height: 0.85;
  letter-spacing: -2px;
  color: #000;
}
.lv-stage {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  opacity: 0.7;
  color: #000;
}
.lv-carid {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  opacity: 0.4;
  color: #000;
}
.lv-btn {
  font-family: 'Archivo Black', sans-serif;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: -0.3px;
  color: #000;
  border: 4px solid #000;
  padding: 10px 20px;
  cursor: pointer;
}
`;

export const LoadingView: React.FC<LoadingViewProps> = ({ stage, carId, onRefresh }) => {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    setStuck(false);
    const t = setTimeout(() => setStuck(true), 25000);
    return () => clearTimeout(t);
  }, [stage, carId]);

  const stageText = stuck
    ? '응답이 늦어요. 엔카 로딩이 느리거나 페이지가 아직 준비 중일 수 있어요.'
    : stage && stage in STAGE_LABEL
      ? STAGE_LABEL[stage]
      : stage
        ? stage.toUpperCase()
        : 'FETCHING REPORT';

  return (
    <div className="lv-container">
      <div className="lv-title">{stuck ? 'STUCK?' : 'LOADING'}</div>
      <div className="lv-stage">{stageText}</div>
      {carId && <div className="lv-carid">CARID · {carId}</div>}
      <button
        className="lv-btn"
        style={{ background: stuck ? '#e4ff00' : '#fff' }}
        onClick={onRefresh}
      >
        MANUAL REFETCH
      </button>
    </div>
  );
};
