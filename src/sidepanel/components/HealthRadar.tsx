import React from 'react';
import type { RuleResult } from '@/core/types/RuleTypes.js';
import { computeRadarAxes } from '../lib/radar.js';

interface HealthRadarProps {
  results: RuleResult[];
}

export const css: string = `
  .autoverdict-radar-container {
    padding: 4px 14px 12px;
    border-bottom: 4px solid #000;
  }
  .autoverdict-radar-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 2px;
  }
  .autoverdict-radar-header-text {
    text-align: right;
    font-family: 'Space Mono', monospace;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 2px;
    line-height: 1.4;
  }
  .autoverdict-radar-header-title {
    opacity: 1;
  }
  .autoverdict-radar-header-index {
    opacity: 0.5;
  }
  .autoverdict-radar-svg {
    width: 100%;
    max-width: 340px;
    height: auto;
    display: block;
    margin: 0 auto;
  }
  .autoverdict-radar-poly {
    animation: autoverdict-radar-draw 500ms ease-out both;
    stroke-dasharray: 2000;
  }
`;

const CX = 180;
const CY = 160;
const R_OUTER = 110;
const RINGS = [110, 82, 55, 28];
const LABEL_R = 135;
const N = 5;

function axisAngle(i: number): number {
  return -Math.PI / 2 + i * ((2 * Math.PI) / N);
}

function polarToXY(r: number, angle: number): [number, number] {
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

function pointsStr(points: Array<[number, number]>): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function textAnchor(i: number): 'start' | 'middle' | 'end' {
  // i=0 top, i=1 right, i=2 bottom-right, i=3 bottom-left, i=4 left
  if (i === 4) return 'end';
  if (i === 1) return 'start';
  return 'middle';
}

export const HealthRadar: React.FC<HealthRadarProps> = ({ results }) => {
  const axes = computeRadarAxes(results);

  // Grid ring polygons
  const ringPolygons = RINGS.map((r) => {
    const pts = Array.from({ length: N }, (_, i) => polarToXY(r, axisAngle(i)));
    return { r, pts };
  });

  // Axis lines: center to outer ring vertex
  const axisLines = Array.from({ length: N }, (_, i) => {
    const [x, y] = polarToXY(R_OUTER, axisAngle(i));
    return { x, y };
  });

  // Data polygon vertices
  const dataPoints = axes.map((axis, i) => {
    const r = (axis.pct / 100) * R_OUTER;
    return polarToXY(r, axisAngle(i));
  });

  return (
    <div className="autoverdict-radar-container">
      <div className="autoverdict-radar-header">
        <div className="autoverdict-radar-header-text">
          <div className="autoverdict-radar-header-title">◇ HEALTH RADAR</div>
          <div className="autoverdict-radar-header-index">01 / 02</div>
        </div>
      </div>
      <svg
        viewBox="-30 -10 420 330"
        className="autoverdict-radar-svg"
        aria-label="Health radar chart"
      >
        {/* Diagonal hatch pattern for data polygon fill */}
        <defs>
          <pattern
            id="autoverdict-hatch"
            patternUnits="userSpaceOnUse"
            width={6}
            height={6}
            patternTransform="rotate(45)"
          >
            <rect width={6} height={6} fill="#e4ff00" />
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={6}
              stroke="#000"
              strokeWidth={2}
            />
          </pattern>
        </defs>

        {/* Grid rings */}
        {ringPolygons.map(({ r, pts }) => (
          <polygon
            key={r}
            points={pointsStr(pts)}
            fill="none"
            stroke="#000"
            strokeWidth={r === R_OUTER ? 1.5 : 0.75}
            opacity={r === R_OUTER ? 1 : 0.25}
          />
        ))}

        {/* Axis dashed lines */}
        {axisLines.map(({ x, y }, i) => (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke="#000"
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.4}
          />
        ))}

        {/* Data polygon — yellow bg + black diagonal hatch */}
        <polygon
          points={pointsStr(dataPoints)}
          fill="url(#autoverdict-hatch)"
          stroke="#000"
          strokeWidth={3}
          className="autoverdict-radar-poly"
        />

        {/* Vertex dots */}
        {dataPoints.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={5} fill="#000" />
        ))}

        {/* Labels */}
        {axes.map((axis, i) => {
          const [lx, ly] = polarToXY(LABEL_R, axisAngle(i));
          const anchor = textAnchor(i);
          const labelFill = axis.pct < 50 ? '#ff2d4b' : '#000';
          const subFill = axis.pct < 50 ? '#ff2d4b' : '#000';
          const subOpacity = axis.pct >= 50 ? 0.6 : 1;

          return (
            <g key={i}>
              <text
                x={lx}
                y={ly + 4}
                textAnchor={anchor}
                fontFamily="'Archivo Black', sans-serif"
                fontSize={11}
                fill={labelFill}
                fontWeight={900}
              >
                {axis.category}
              </text>
              <text
                x={lx}
                y={ly + 4 + 12}
                textAnchor={anchor}
                fontFamily="'Space Mono', monospace"
                fontSize={9}
                fill={subFill}
                opacity={subOpacity}
              >
                {axis.pass}/{axis.total} · {axis.pct}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
