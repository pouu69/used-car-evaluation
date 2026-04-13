import React, { useState } from 'react';
import { SavedList, css as savedListCss } from './SavedList.js';

type HomeTab = 'home' | 'mylist';

export const css = `
${savedListCss}
.hp-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Header ── */
.hp-header {
  padding: 32px 20px 24px;
  border-bottom: 3px solid #000;
  text-align: center;
}
.hp-brand {
  font-family: 'Archivo Black', sans-serif;
  font-size: 28px;
  letter-spacing: -1px;
  line-height: 1;
  color: #000;
}
.hp-sub {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #666;
  margin-top: 6px;
}

/* ── Tab bar ── */
.hp-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 3px solid #000;
}
.hp-tab {
  padding: 10px 0;
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  text-align: center;
  cursor: pointer;
  border: none;
  border-right: 3px solid #000;
  background: #fff;
  color: #000;
  transition: background 0.1s, color 0.1s;
}
.hp-tab:last-child {
  border-right: none;
}
.hp-tab[data-active='true'] {
  background: #000;
  color: #fff;
}

/* ── Home content ── */
.hp-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 35px;
  padding: 100px 20px 32px 0px;
  text-align: center;
}
/* ── CSS Car ── */
.hp-car {
  position: relative;
  width: 160px;
  height: 80px;
  margin: 0 auto;
}
.hp-car-roof {
  position: absolute;
  top: 0;
  left: 37px;
  width: 86px;
  height: 32px;
  background: #000;
  clip-path: polygon(12% 100%, 88% 100%, 72% 0%, 28% 0%);
}
.hp-car-body {
  position: absolute;
  top: 27px;
  left: 0;
  width: 160px;
  height: 37px;
  background: #000;
  border-radius: 3px;
}
.hp-car-window {
  position: absolute;
  top: 4px;
  width: 30px;
  height: 18px;
  background: #CCFF00;
}
.hp-car-window--l {
  left: 40px;
  clip-path: polygon(20% 0%, 100% 0%, 100% 100%, 0% 100%);
}
.hp-car-window--r {
  left: 74px;
  clip-path: polygon(0% 0%, 80% 0%, 100% 100%, 0% 100%);
}
.hp-car-wheel {
  position: absolute;
  bottom: 0;
  width: 26px;
  height: 26px;
  background: #333;
  border: 3px solid #000;
  border-radius: 50%;
}
.hp-car-wheel::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  background: #CCFF00;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.hp-car-wheel--l {
  left: 20px;
}
.hp-car-wheel--r {
  right: 20px;
}
.hp-start-btn {
  font-family: 'Archivo Black', sans-serif;
  font-size: 16px;
  letter-spacing: 0.5px;
  color: #000;
  background: #CCFF00;
  border: 3px solid #000;
  padding: 12px 32px;
  cursor: pointer;
  text-transform: uppercase;
  transition: background 0.1s, color 0.1s;
}
.hp-start-btn:hover {
  background: #000;
  color: #CCFF00;
}
.hp-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  width: 100%;
  max-width: 280px;
}
.hp-step {
  display: flex;
  gap: 10px;
  align-items: baseline;
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.5px;
  color: #000;
}
.hp-step-num {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  color: #CCFF00;
  background: #000;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hp-note {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 1px;
  color: #999;
  margin-top: 4px;
}

/* ── MyList section ── */
.hp-mylist {
  flex: 1;
}
`;

interface EmptyStateProps {
  savedListKey?: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ savedListKey = 0 }) => {
  const [homeTab, setHomeTab] = useState<HomeTab>('home');

  const handleViewCar = (carId: string) => {
    // From home page, open the encar URL in a new tab via saved data
    chrome.runtime.sendMessage({ type: 'GET_SAVED_ONE', carId }).then((row) => {
      if (row?.url) {
        chrome.tabs.create({ url: row.url });
      }
    }).catch(() => {});
  };

  return (
    <div className="hp-root">
      <div className="hp-header">
        <div className="hp-brand">AUTOVERDICT</div>
        <div className="hp-sub">중고차 체크리스트 · 12 Rules</div>
      </div>

      <div className="hp-tabs">
        <button
          className="hp-tab"
          data-active={homeTab === 'home'}
          onClick={() => setHomeTab('home')}
        >
          HOME
        </button>
        <button
          className="hp-tab"
          data-active={homeTab === 'mylist'}
          onClick={() => setHomeTab('mylist')}
        >
          ★ MY LIST
        </button>
      </div>

      {homeTab === 'home' && (
        <div className="hp-guide">
          <div className="hp-car">
            <div className="hp-car-roof" />
            <div className="hp-car-body">
              <div className="hp-car-window hp-car-window--l" />
              <div className="hp-car-window hp-car-window--r" />
            </div>
            <div className="hp-car-wheel hp-car-wheel--l" />
            <div className="hp-car-wheel hp-car-wheel--r" />
          </div>
          <button
            className="hp-start-btn"
            onClick={() => chrome.tabs.create({ url: 'https://fem.encar.com' })}
          >
            시작하기 →
          </button>
          <div className="hp-steps">
            <div className="hp-step">
              <span className="hp-step-num">1</span>
              <span>fem.encar.com 에서 매물 검색</span>
            </div>
            <div className="hp-step">
              <span className="hp-step-num">2</span>
              <span>매물 상세 페이지 클릭</span>
            </div>
            <div className="hp-step">
              <span className="hp-step-num">3</span>
              <span>자동 평가 결과 확인</span>
            </div>
          </div>
          <div className="hp-note">
            * 보험이력·소유자 변경 정보는 엔카 로그인 필요
          </div>
        </div>
      )}

      {homeTab === 'mylist' && (
        <div className="hp-mylist">
          <SavedList onViewCar={handleViewCar} refreshKey={savedListKey} />
        </div>
      )}
    </div>
  );
};
