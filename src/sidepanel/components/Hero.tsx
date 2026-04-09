import React from 'react';
import type { Verdict, RuleResult } from '@/core/types/RuleTypes.js';
import { useCountUp } from '../hooks/useCountUp.js';
import { mapVerdictLabel, buildVerdictSummary } from '../lib/verdict.js';

interface HeroProps {
  score: number;
  verdict: Verdict;
  killers: RuleResult[];
  warns: RuleResult[];
}

export const css: string = `
.hero {
  display: flex;
  border-bottom: 4px solid #000;
}
.hero-score {
  padding: 8px 8px 6px 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.hero-score-label {
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #000;
}
.hero-score-number {
  font-family: 'Archivo Black', sans-serif;
  font-size: 86px;
  line-height: 0.85;
  letter-spacing: -3px;
  color: #000;
}
.hero-score-sub {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  opacity: 0.6;
  margin-top: -2px;
}
.hero-verdict {
  flex: 1;
  border-left: 4px solid #000;
  background: #e4ff00;
  padding: 10px 12px 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
}
.hero-verdict-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff2d4b;
  box-shadow: 0 0 0 2px #000;
}
.hero-verdict-tag {
  font-family: 'Space Mono', monospace;
  font-size: 8px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #000;
}
.hero-verdict-label {
  font-family: 'Archivo Black', sans-serif;
  font-size: 20px;
  line-height: 0.9;
  letter-spacing: -0.5px;
  margin-top: 5px;
  color: #000;
}
.hero-verdict-summary {
  font-family: 'Space Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.3px;
  line-height: 1.4;
  margin-top: 8px;
  border-top: 2px solid #000;
  padding-top: 5px;
  color: #000;
}
`;

export const Hero: React.FC<HeroProps> = ({ score, verdict, killers, warns }) => {
  const animatedScore = useCountUp(score, 600);
  const label = mapVerdictLabel(verdict);
  const summary = buildVerdictSummary(killers, warns);

  return (
    <div className="hero">
      <div className="hero-score">
        <div className="hero-score-label">SCORE</div>
        <div className="hero-score-number">{animatedScore}</div>
        <div className="hero-score-sub">OUT OF 100</div>
      </div>
      <div className="hero-verdict">
        {killers.length > 0 && <div className="hero-verdict-dot" />}
        <div>
          <div className="hero-verdict-tag">◆ VERDICT</div>
          <div className="hero-verdict-label">
            {label.split('\n').map((ln, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {ln}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="hero-verdict-summary">{summary}</div>
      </div>
    </div>
  );
};
