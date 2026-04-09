import React from 'react';

export const css = `
.es-container {
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
.es-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 64px;
  line-height: 0.85;
  letter-spacing: -2px;
  color: #000;
}
.es-primary {
  font-family: 'Inter Tight', sans-serif;
  font-size: 13px;
  line-height: 1.6;
  color: #000;
}
.es-secondary {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  opacity: 0.6;
  color: #000;
}
`;

export const EmptyState: React.FC = () => (
  <div className="es-container">
    <div className="es-title">NOT A CAR</div>
    <div className="es-primary">
      엔카 매물 페이지(fem.encar.com/cars/detail/...)를 열면 자동으로 평가가 시작됩니다.
    </div>
    <div className="es-secondary">
      * 보험이력·소유자 변경 정보는 엔카 로그인이 필요합니다
    </div>
  </div>
);
