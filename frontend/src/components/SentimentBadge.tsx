import { useState } from 'react';

interface SentimentBadgeProps {
  label?: string | null;
  score?: number | null;
  note?: string | null;
}

const LABEL_STYLES: Record<string, string> = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  negative: 'bg-rose-50 text-rose-700 border-rose-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function SentimentBadge({ label, score, note }: SentimentBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!label) return null;

  const style = LABEL_STYLES[label.toLowerCase()] ?? LABEL_STYLES.neutral;

  return (
    <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Sentiment (unvalidated heuristic)
        </span>
        <div className="relative">
          <button
            type="button"
            aria-label="What does this mean?"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-400 transition-colors hover:border-brand-300 hover:text-brand-500"
          >
            i
          </button>
          {showTooltip && note && (
            <div className="absolute left-1/2 top-6 z-10 w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-600 shadow-lg">
              {note}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}
        >
          {label.toLowerCase()}
        </span>
        {typeof score === 'number' && (
          <span className="text-xs text-slate-400">confidence {(score * 100).toFixed(0)}%</span>
        )}
      </div>
    </div>
  );
}
