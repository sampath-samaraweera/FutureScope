import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  getForecastCompanies,
  getForecastCompanyDates,
  predictFromDataset,
  predictLive,
} from '../api/forecastClient';
import type { DatasetPredictionResponse, LivePredictionResponse } from '../api/forecastTypes';
import CompanySelector from '../components/CompanySelector';

function ForecastRow({ label, forecast }: { label: string; forecast: number[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {forecast.map((r, i) => (
          <div key={i} className="rounded-xl bg-slate-50 p-3 text-center">
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
  const [yoyInflation, setYoyInflation] = useState('6.5');
  const [result, setResult] = useState<LivePredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handlePredict() {
    if (!symbol.trim()) return;
    setLoading(true);
    setError(null);
    const inflationValue = parseFloat(yoyInflation);
    predictLive(symbol.trim(), Number.isFinite(inflationValue) ? inflationValue : undefined)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Live prediction failed.'))
      .finally(() => setLoading(false));
  }

  const historySorted = result ? [...result.price_history].sort((a, b) => (a.date < b.date ? -1 : 1)) : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Live forecast</h2>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <CompanySelector value={symbol} onChange={setSymbol} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">YoY inflation (%)</label>
          <input
            className="w-28 rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            type="number"
            step="0.1"
            value={yoyInflation}
            onChange={(e) => setYoyInflation(e.target.value)}
          />
        </div>
        <button
          className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition-all hover:shadow-md hover:shadow-brand-600/40 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
          disabled={!symbol.trim() || loading}
          onClick={handlePredict}
        >
          {loading ? 'Fetching + predicting…' : 'Predict live'}
        </button>
      </div>

      {error && (
        <div className="card border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700">{error}</div>
      )}

      {result && (
        <>
          <div className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">{result.company_id}</h3>
              <p className="text-2xl font-bold tracking-tight text-slate-900">
                Rs. {result.last_close_price.toFixed(2)}
              </p>
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
                    <div key={i} className="rounded-xl bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-400">Day +{i + 1}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{p.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-800">
              Live price history ({historySorted.length} days) - CSE + real USD/LKR rate
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
                    <th className="py-1.5 text-right">Trade Vol.</th>
                    <th className="py-1.5 text-right">Share Vol.</th>
                    <th className="py-1.5 text-right">Turnover</th>
                    <th className="py-1.5 text-right">USD/LKR</th>
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
                        {p.trade_volume ? Math.round(p.trade_volume).toLocaleString() : '—'}
                      </td>
                      <td className="py-1.5 text-right text-slate-500">
                        {p.share_volume ? Math.round(p.share_volume).toLocaleString() : '—'}
                      </td>
                      <td className="py-1.5 text-right text-slate-500">
                        {p.turnover ? Math.round(p.turnover).toLocaleString() : '—'}
                      </td>
                      <td className="py-1.5 text-right text-slate-500">
                        {p.exchange_rate?.toFixed(2) ?? '—'}
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
    // <div className="space-y-4">
    //   <div>
    //     <h2 className="text-lg font-semibold text-slate-900">Historical replay</h2>
    //   </div>

    //   {companiesError && (
    //     <div className="card border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-700">
    //       {companiesError}
    //     </div>
    //   )}

    //   <div className="flex flex-wrap gap-3">
    //     <select
    //       className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
    //       value={companyId}
    //       onChange={(e) => setCompanyId(e.target.value)}
    //       disabled={companies.length === 0}
    //     >
    //       <option value="">Select a company…</option>
    //       {companies.map((id) => (
    //         <option key={id} value={id}>
    //           {id}
    //         </option>
    //       ))}
    //     </select>

    //     <select
    //       className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
    //       value={endDate}
    //       onChange={(e) => setEndDate(e.target.value)}
    //       disabled={!companyId || dates.length === 0}
    //     >
    //       <option value="">Most recent available date</option>
    //       {dates
    //         .slice()
    //         .reverse()
    //         .map((d) => (
    //           <option key={d} value={d}>
    //             {d}
    //           </option>
    //         ))}
    //     </select>

    //     <button
    //       className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition-all hover:shadow-md hover:shadow-brand-600/40 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
    //       disabled={!companyId || loading}
    //       onClick={handlePredict}
    //     >
    //       {loading ? 'Predicting…' : 'Predict'}
    //     </button>
    //   </div>

    //   {error && (
    //     <div className="card border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700">{error}</div>
    //   )}

    //   {result && (
    //     <div className="card p-5">
    //       <h3 className="text-lg font-semibold text-slate-900">{result.company_id}</h3>
    //       <p className="mt-1 text-xs text-slate-400">
    //         20-day window: {result.window_start_date} → {result.window_end_date}
    //       </p>
    //       <div className="mt-4">
    //         <ForecastRow label="Predicted return" forecast={result.forecast} />
    //       </div>
    //     </div>
    //   )}
    // </div>
    <></>
  );
}

interface BaselineRow {
  model: string;
  horizon: string;
  rmse: number;
  mae: number;
  r2: number;
}

const BASELINE_METRICS: BaselineRow[] = [
  { model: 'Baseline', horizon: 't+1', rmse: 2.311701, mae: 1.702370, r2: -0.183636 },
  { model: 'Baseline', horizon: 't+2', rmse: 3.173252, mae: 2.004846, r2: -0.020722 },
  { model: 'Baseline', horizon: 't+3', rmse: 4.036981, mae: 2.766947, r2: -0.031455 },
  { model: 'Baseline', horizon: 't+4', rmse: 4.599443, mae: 3.180034, r2: -0.024818 },
  { model: 'Baseline', horizon: 't+5', rmse: 5.221336, mae: 3.441999, r2: -0.070010 },
];

interface OverallRankingRow {
  model: string;
  rmse: number;
  mae: number;
  r2: number;
}

const OVERALL_RANKING: OverallRankingRow[] = [
  { model: 'DE', rmse: 3.793529, mae: 2.451263, r2: -0.013871 },
  { model: 'TLBO', rmse: 3.810897, mae: 2.533035, r2: -0.026163 },
  { model: 'Baseline', rmse: 3.868543, mae: 2.619239, r2: -0.066128 },
  { model: 'SA', rmse: 3.935159, mae: 2.481436, r2: -0.112793 },
  { model: 'PSO', rmse: 4.040872, mae: 2.616002, r2: -0.163349 },
];

interface ValidationPlot {
  title: string;
  file: string;
  description: string;
}

const VALIDATION_PLOTS: ValidationPlot[] = [
  {
    title: 'RMSE by forecast horizon',
    file: 'rmse-by-horizon.png',
    description: 'RMSE rises with horizon length for every optimizer, and DE tracks closest to the lowest error out to t+5.',
  },
  {
    title: 'Mean RMSE and MAE by model',
    file: 'mean-metrics-by-model.png',
    description: 'Averaged across all 5 horizons, DE edges out TLBO, Baseline, SA, and PSO on both RMSE and MAE.',
  },
];

function ValidationSection() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Validation</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {VALIDATION_PLOTS.map((plot) => (
          <div key={plot.file} className="card p-5">
            <h3 className="text-sm font-semibold text-slate-800">{plot.title}</h3>
            <div className="mt-3 flex min-h-[220px] items-center justify-center rounded-xl bg-slate-50">
              <img
                src={`/plots/return-forecast/${plot.file}`}
                alt={plot.title}
                className="max-h-80 w-full object-contain"
              />
            </div>
            <p className="mt-3 text-sm text-slate-600">{plot.description}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-800">
          Overall ranking (mean across all 5 horizons)
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5">Model</th>
                <th className="py-1.5 text-right">RMSE (%)</th>
                <th className="py-1.5 text-right">MAE (%)</th>
                <th className="py-1.5 text-right">R²</th>
              </tr>
            </thead>
            <tbody>
              {OVERALL_RANKING.map((row) => (
                <tr key={row.model} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 text-slate-900">{row.model}</td>
                  <td className="py-1.5 text-right text-slate-900">{row.rmse.toFixed(2)}</td>
                  <td className="py-1.5 text-right text-slate-900">{row.mae.toFixed(2)}</td>
                  <td className="py-1.5 text-right text-slate-900">{row.r2.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-800">Baseline model</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5">Model</th>
                <th className="py-1.5">Horizon</th>
                <th className="py-1.5 text-right">RMSE (%)</th>
                <th className="py-1.5 text-right">MAE (%)</th>
                <th className="py-1.5 text-right">R²</th>
              </tr>
            </thead>
            <tbody>
              {BASELINE_METRICS.map((row) => (
                <tr key={row.horizon} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 text-slate-500">{row.model}</td>
                  <td className="py-1.5 text-slate-900">{row.horizon}</td>
                  <td className="py-1.5 text-right text-slate-900">{row.rmse.toFixed(2)}</td>
                  <td className="py-1.5 text-right text-slate-900">{row.mae.toFixed(2)}</td>
                  <td className="py-1.5 text-right text-slate-900">{row.r2.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800">
        <strong>Coming soon.</strong> Validation metrics and plots for the hybrid RNN-BiLSTM model
        aren't wired up yet - the table above is the baseline for comparison.
      </div>
    </div>
  );
}

type Tab = 'forecasting' | 'validation';

const TABS: { id: Tab; label: string }[] = [
  { id: 'forecasting', label: 'Forecasting' },
  { id: 'validation', label: 'Validation' },
];

export default function ReturnForecast() {
  const [tab, setTab] = useState<Tab>('forecasting');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">5-day return forecast</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Hybrid RNN-BiLSTM model - predicts the next 5 trading days' returns from a 20-day
          window of technical indicators.
        </p>
      </div>

      <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'forecasting' && (
        <div className="space-y-10">
          <LiveForecastSection />
          <hr className="border-slate-200" />
          <HistoricalReplaySection />
        </div>
      )}
      {tab === 'validation' && <ValidationSection />}
    </div>
  );
}
