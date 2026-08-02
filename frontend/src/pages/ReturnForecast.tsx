import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  getForecastCompanies,
  getForecastCompanyDates,
  predictFromDataset,
  predictLive,
} from '../api/forecastClient';
import type { DatasetPredictionResponse, LivePredictionResponse } from '../api/forecastTypes';

function ForecastRow({ label, forecast }: { label: string; forecast: number[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {forecast.map((r, i) => (
          <div key={i} className="rounded-md bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-400">Day +{i + 1}</p>
            <p
              className={`mt-1 text-sm font-semibold ${r >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
            >
              {r >= 0 ? '+' : ''}
              {(r * 100).toFixed(2)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveForecastSection() {
  const [symbol, setSymbol] = useState('COMB.N0000');
  const [result, setResult] = useState<LivePredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handlePredict() {
    if (!symbol.trim()) return;
    setLoading(true);
    setError(null);
    predictLive(symbol.trim())
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Live prediction failed.'))
      .finally(() => setLoading(false));
  }

  const historySorted = result ? [...result.price_history].sort((a, b) => (a.date < b.date ? -1 : 1)) : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Live forecast</h2>
        <p className="mt-1 text-sm text-slate-500">
          Fetches real, current price history from CSE for the symbol below and predicts from
          it. <span className="font-medium text-amber-700">Sector index, exchange rate, and inflation
          inputs are not live yet</span> (no source wired up) — treat the forecast as a rough demo,
          not a fully live macro picture.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="e.g. COMB.N0000"
        />
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!symbol.trim() || loading}
          onClick={handlePredict}
        >
          {loading ? 'Fetching + predicting…' : 'Predict live'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">{result.company_id}</h3>
              <p className="text-xl font-bold text-slate-900">Rs. {result.last_close_price.toFixed(2)}</p>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              20-day window: {result.window_start_date} → {result.window_end_date} ·{' '}
              {result.synthetic_rows_in_window === 0 ? (
                <span className="text-emerald-700">fully real data</span>
              ) : (
                <span className="text-amber-700">
                  {result.synthetic_rows_in_window} of 20 days are synthetic padding
                </span>
              )}
            </p>

            <div className="mt-4 space-y-4">
              <ForecastRow label="Predicted return" forecast={result.forecast} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Predicted price (Rs.)
                </p>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {result.predicted_price.map((p, i) => (
                    <div key={i} className="rounded-md bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-400">Day +{i + 1}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{p.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">
              Live price history from CSE ({historySorted.length} days)
            </h3>
            <div className="mt-3 max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-1.5">Date</th>
                    <th className="py-1.5 text-right">Open</th>
                    <th className="py-1.5 text-right">High</th>
                    <th className="py-1.5 text-right">Low</th>
                    <th className="py-1.5 text-right">Close</th>
                    <th className="py-1.5 text-right">Turnover</th>
                  </tr>
                </thead>
                <tbody>
                  {historySorted.map((p) => (
                    <tr key={p.date} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 text-slate-500">{p.date}</td>
                      <td className="py-1.5 text-right text-slate-900">{p.open?.toFixed(2) ?? '—'}</td>
                      <td className="py-1.5 text-right text-slate-900">{p.high?.toFixed(2) ?? '—'}</td>
                      <td className="py-1.5 text-right text-slate-900">{p.low?.toFixed(2) ?? '—'}</td>
                      <td className="py-1.5 text-right text-slate-900">{p.close?.toFixed(2) ?? '—'}</td>
                      <td className="py-1.5 text-right text-slate-500">
                        {p.turnover ? Math.round(p.turnover).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function HistoricalReplaySection() {
  const [companies, setCompanies] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState<DatasetPredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);

  useEffect(() => {
    getForecastCompanies()
      .then(setCompanies)
      .catch((err) =>
        setCompaniesError(
          err instanceof ApiError ? err.message : 'Could not reach the return-forecast service.',
        ),
      );
  }, []);

  useEffect(() => {
    setEndDate('');
    setResult(null);
    if (!companyId) {
      setDates([]);
      return;
    }
    getForecastCompanyDates(companyId)
      .then(setDates)
      .catch(() => setDates([]));
  }, [companyId]);

  function handlePredict() {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    predictFromDataset(companyId, endDate)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Prediction failed.'))
      .finally(() => setLoading(false));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Historical replay</h2>
        <p className="mt-1 text-sm text-slate-500">
          Replays a known date from the model's own training/test dataset, not live CSE data.
          Requires <code>data/X_train_scaled.csv</code> on the backend.
        </p>
      </div>

      {companiesError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {companiesError}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          disabled={companies.length === 0}
        >
          <option value="">Select a company…</option>
          {companies.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          disabled={!companyId || dates.length === 0}
        >
          <option value="">Most recent available date</option>
          {dates
            .slice()
            .reverse()
            .map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
        </select>

        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!companyId || loading}
          onClick={handlePredict}
        >
          {loading ? 'Predicting…' : 'Predict'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">{result.company_id}</h3>
          <p className="mt-1 text-xs text-slate-400">
            20-day window: {result.window_start_date} → {result.window_end_date}
          </p>
          <div className="mt-4">
            <ForecastRow label="Predicted return" forecast={result.forecast} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReturnForecast() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">5-day return forecast</h1>
        <p className="mt-1 text-sm text-slate-500">
          Hybrid RNN-BiLSTM model — predicts the next 5 trading days' returns from a 20-day
          window of technical indicators.
        </p>
      </div>

      <LiveForecastSection />
      <hr className="border-slate-200" />
      <HistoricalReplaySection />
    </div>
  );
}
