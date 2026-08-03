import { useRef, useState } from 'react';
import type { BacktestDay } from '../api/portfolioTypes';

interface EquityCurveProps {
  days: BacktestDay[];
  initialCapital: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const WIDTH = 640;
const HEIGHT = 200;
const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

export default function EquityCurve({ days, initialCapital, selectedIndex, onSelect }: EquityCurveProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (days.length === 0) return null;

  const values = days.map((d) => d.portfolio_value);
  const minValue = Math.min(initialCapital, ...values);
  const maxValue = Math.max(initialCapital, ...values);
  const range = maxValue - minValue || 1;

  const plotWidth = WIDTH - PAD_X * 2;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xAt = (i: number) => PAD_X + (days.length === 1 ? 0 : (i / (days.length - 1)) * plotWidth);
  const yAt = (v: number) => PAD_TOP + plotHeight - ((v - minValue) / range) * plotHeight;

  const linePath = days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(d.portfolio_value).toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${xAt(days.length - 1).toFixed(2)} ${(PAD_TOP + plotHeight).toFixed(2)} L ${xAt(0).toFixed(2)} ${(PAD_TOP + plotHeight).toFixed(2)} Z`;

  const activeIndex = hoverIndex ?? selectedIndex;
  const active = days[activeIndex];

  function indexFromClientX(clientX: number): number {
    const svg = svgRef.current;
    if (!svg) return selectedIndex;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * WIDTH;
    const frac = (relX - PAD_X) / plotWidth;
    const idx = Math.round(frac * (days.length - 1));
    return Math.min(days.length - 1, Math.max(0, idx));
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full cursor-crosshair"
        onMouseMove={(e) => setHoverIndex(indexFromClientX(e.clientX))}
        onMouseLeave={() => setHoverIndex(null)}
        onClick={(e) => onSelect(indexFromClientX(e.clientX))}
      >
        <line
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={yAt(initialCapital)}
          y2={yAt(initialCapital)}
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <path d={areaPath} fill="url(#equity-gradient)" stroke="none" />
        <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <defs>
          <linearGradient id="equity-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>

        {active && (
          <>
            <line
              x1={xAt(activeIndex)}
              x2={xAt(activeIndex)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotHeight}
              stroke="#cbd5e1"
              strokeWidth={1}
            />
            <circle cx={xAt(activeIndex)} cy={yAt(active.portfolio_value)} r={4} fill="#4338ca" stroke="white" strokeWidth={2} />
          </>
        )}

        <text x={PAD_X} y={HEIGHT - 6} className="fill-slate-400" fontSize={10}>
          {days[0].label}
        </text>
        <text x={WIDTH - PAD_X} y={HEIGHT - 6} textAnchor="end" className="fill-slate-400" fontSize={10}>
          {days[days.length - 1].label}
        </text>
      </svg>

      {active && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-card">
          <p className="font-medium text-slate-700">{active.label}</p>
          <p className="text-slate-500">
            Rs. {active.portfolio_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      )}
    </div>
  );
}
