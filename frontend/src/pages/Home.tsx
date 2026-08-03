import { useState } from 'react';
import { ApiError, predict } from '../api/client';
import type { PredictRequest, PredictResponse } from '../api/types';
import HeadlineForm from '../components/HeadlineForm';
import ResultsCard from '../components/ResultsCard';

export default function Home() {
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [actualCarPct, setActualCarPct] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(payload: PredictRequest, actual?: number) {
    setLoading(true);
    setError(null);
    setResult(null);
    setActualCarPct(actual);
    try {
      const res = await predict(payload);
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong reaching the API.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500">
        FinBERT-powered market-reaction magnitude, live CSE data end to end.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <HeadlineForm onSubmit={handleSubmit} loading={loading} />

        <div>
          {loading && (
            <div className="card flex h-full min-h-[220px] flex-col items-center justify-center gap-3 border-dashed">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              <span className="text-sm text-slate-500">Running FinBERT inference…</span>
            </div>
          )}
          {!loading && error && (
            <div className="card border-rose-200 bg-rose-50/70 p-5 text-sm text-rose-700">
              {error}
            </div>
          )}
          {!loading && !error && result && (
            <ResultsCard result={result} actualCarPct={actualCarPct} />
          )}
          {!loading && !error && !result && (
            <div className="card flex h-full min-h-[220px] items-center justify-center border-dashed text-sm text-slate-400">
              Results will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
