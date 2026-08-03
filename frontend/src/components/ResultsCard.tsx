import type { PredictResponse } from '../api/types';
import { CATEGORY_LABELS } from '../lib/categoryPreview';
import SentimentBadge from './SentimentBadge';

interface ResultsCardProps {
  result: PredictResponse;
  actualCarPct?: number;
}

export default function ResultsCard({ result, actualCarPct }: ResultsCardProps) {
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
    <div className="card p-6">
      {(category_mismatch_warning || ticker_mismatch_warning) && (
        <div className="mb-4 space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {category_mismatch_warning && <p>⚠ {category_mismatch_warning}</p>}
          {ticker_mismatch_warning && <p>⚠ {ticker_mismatch_warning}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Expected market reaction</p>
          <p className="mt-1 bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
            {predicted_car_magnitude_pct.toFixed(2)}%
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
            is_likely_significant
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              is_likely_significant ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
          {is_likely_significant ? 'Likely significant' : 'Likely minor'}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Significance cutoff: {significance_cutoff_pct.toFixed(2)}%
      </p>

      {/* {actualCarPct !== undefined && (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <span className="text-slate-500">Actual historical outcome: </span>
          <span
            className={`font-semibold ${actualCarPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
          >
            {actualCarPct >= 0 ? '+' : ''}
            {(actualCarPct * 100).toFixed(2)}%
          </span>
          <span className="ml-1 text-xs text-slate-400">
            (what really happened - the model above predicts magnitude only, never direction)
          </span>
        </div>
      )} */}

      {magnitude_note && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{magnitude_note}</p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs font-medium text-slate-400">Category</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-800">
            {CATEGORY_LABELS[resolved_category]}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs font-medium text-slate-400">Volatility (10d) used</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-800">
            {(resolved_volatility_10d * 100).toFixed(1)}%{' '}
            <span
              className={`text-xs font-normal ${
                volatility_source === 'live' ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              ({volatility_source === 'live' ? 'live' : 'market default'})
            </span>
          </dd>
        </div>
        {ticker_used && (
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs font-medium text-slate-400">Company</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-800">{ticker_used}</dd>
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
