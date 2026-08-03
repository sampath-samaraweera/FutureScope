import { useEffect, useState } from 'react';
import { ApiError, getCompanySnapshot } from '../api/client';
import type { CompanySnapshot as CompanySnapshotType } from '../api/types';
import CompanySelector from '../components/CompanySelector';

export default function CompanySnapshot() {
  const [ticker, setTicker] = useState('');
  const [snapshot, setSnapshot] = useState<CompanySnapshotType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError(null);
    getCompanySnapshot(ticker)
      .then(setSnapshot)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load company data.'))
      .finally(() => setLoading(false));
  }, [ticker]);

  const historySorted = snapshot
    ? [...snapshot.price_history].sort((a, b) => (a.date < b.date ? -1 : 1))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Live stock prices</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Live data from the CSE API - current price and the recent daily closes used to compute
          the volatility fed into predictions for this company.
        </p>
      </div>

      <div className="max-w-sm">
        <CompanySelector value={ticker} onChange={setTicker} />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          Loading…
        </div>
      )}
      {error && (
        <div className="card border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700">{error}</div>
      )}

      {snapshot && (
        <>
          <div className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">
                {snapshot.name} <span className="text-slate-400">({snapshot.ticker})</span>
              </h2>
              {typeof snapshot.price === 'number' && (
                <p className="text-2xl font-bold tracking-tight text-slate-900">
                  Rs. {snapshot.price.toFixed(2)}
                  {typeof snapshot.change_pct === 'number' && (
                    <span
                      className={`ml-2 text-sm font-medium ${
                        snapshot.change_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {snapshot.change_pct >= 0 ? '+' : ''}
                      {snapshot.change_pct.toFixed(2)}%
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Volatility (10d, annualized)</p>
                {snapshot.volatility_available && typeof snapshot.volatility_10d === 'number' ? (
                  <p className="text-lg font-semibold text-emerald-700">
                    {(snapshot.volatility_10d * 100).toFixed(1)}%
                  </p>
                ) : (
                  <p className="text-xs text-amber-700">
                    Unavailable{snapshot.volatility_error ? ` - ${snapshot.volatility_error}` : ''}
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Previous close</p>
                <p className="text-lg font-semibold text-slate-800">
                  {typeof snapshot.previous_close === 'number'
                    ? `Rs. ${snapshot.previous_close.toFixed(2)}`
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-800">Recent daily closes</h3>
            {snapshot.price_history_available && historySorted.length > 0 ? (
              <div className="mt-3 max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-1.5">Date</th>
                      <th className="py-1.5 text-right">Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historySorted.map((p) => (
                      <tr key={p.date} className="border-b border-slate-100 last:border-0">
                        <td className="py-1.5 text-slate-500">{p.date}</td>
                        <td className="py-1.5 text-right text-slate-900">{p.close.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-700">
                {snapshot.price_history_error ?? 'Price history unavailable.'}
              </p>
            )}
          </div>
        </>
      )}

      {!ticker && (
        <div className="card flex min-h-[160px] items-center justify-center border-dashed text-sm text-slate-400">
          Select a company to view its live snapshot.
        </div>
      )}
    </div>
  );
}
