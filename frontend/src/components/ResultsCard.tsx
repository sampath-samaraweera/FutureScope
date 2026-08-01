import type { PredictResponse } from '../api/types';
import { CATEGORY_LABELS } from '../lib/categoryPreview';
import SentimentBadge from './SentimentBadge';

interface ResultsCardProps {
  result: PredictResponse;
}

export default function ResultsCard({ result }: ResultsCardProps) {
  const {
    predicted_car_magnitude_pct,
    is_likely_significant,
    significance_cutoff_pct,
    magnitude_note,
    resolved_category,
    resolved_volatility_10d,
    volatility_source,
    ticker_used,
    category_mismatch_warning,
    ticker_mismatch_warning,
    sentiment_label_UNVALIDATED,
    sentiment_score_UNVALIDATED,
    sentiment_note,
  } = result;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {(category_mismatch_warning || ticker_mismatch_warning) && (
        <div className="mb-4 space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {category_mismatch_warning && <p>⚠ {category_mismatch_warning}</p>}
          {ticker_mismatch_warning && <p>⚠ {ticker_mismatch_warning}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Expected market reaction</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
            {predicted_car_magnitude_pct.toFixed(2)}%
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
            is_likely_significant
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {is_likely_significant ? 'Likely significant' : 'Likely minor'}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Significance cutoff: {significance_cutoff_pct.toFixed(2)}%
      </p>

      <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">{magnitude_note}</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500 sm:grid-cols-3">
        <div>
          <dt className="font-medium text-slate-400">Category</dt>
          <dd>{CATEGORY_LABELS[resolved_category]}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Volatility (10d) used</dt>
          <dd>
            {(resolved_volatility_10d * 100).toFixed(1)}%{' '}
            <span
              className={
                volatility_source === 'live'
                  ? 'text-emerald-600'
                  : 'text-amber-600'
              }
            >
              ({volatility_source === 'live' ? 'live' : 'market default, not live'})
            </span>
          </dd>
        </div>
        {ticker_used && (
          <div>
            <dt className="font-medium text-slate-400">Company</dt>
            <dd>{ticker_used}</dd>
          </div>
        )}
      </dl>

      <SentimentBadge
        label={sentiment_label_UNVALIDATED}
        score={sentiment_score_UNVALIDATED}
        note={sentiment_note}
      />
    </div>
  );
}
