import { useState } from 'react';
import { ApiError, predict } from '../api/client';
import type { PredictRequest, PredictResponse } from '../api/types';
import HeadlineForm from '../components/HeadlineForm';
import ResultsCard from '../components/ResultsCard';

export default function Home() {
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(payload: PredictRequest) {
    setLoading(true);
    setError(null);
    setResult(null);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Predict news impact</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter a CSE-related headline to estimate the size of the market reaction.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <HeadlineForm onSubmit={handleSubmit} loading={loading} />

        <div>
          {loading && (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
              Running FinBERT inference — this can take a couple of seconds…
            </div>
          )}
          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
          {!loading && !error && result && <ResultsCard result={result} />}
          {!loading && !error && !result && (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
              Results will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
