import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getPortfolioBacktest, getPortfolioLiveToday, getPortfolioModelInfo } from '../api/portfolioClient';
import type { Allocation, BacktestResponse, LiveTodayResponse, ModelInfoResponse } from '../api/portfolioTypes';
import EquityCurve from '../components/EquityCurve';

function fmtPct(value: number, digits = 2): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`;
}

function fmtLkr(value: number): string {
  return `Rs. ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function MetricsGrid({ summary }: { summary: BacktestResponse['summary'] }) {
  const rows: [string, string][] = [
    ['Total return', fmtPct(summary.total_return)],
    ['Annualized return', fmtPct(summary.annual_return)],
    ['Annualized volatility', fmtPct(summary.annual_volatility, 1)],
    ['Sharpe ratio', summary.sharpe_ratio.toFixed(2)],
    ['Max drawdown', fmtPct(-Math.abs(summary.max_drawdown), 1)],
    ['Transaction costs', fmtLkr(summary.total_transaction_costs)],
    ['Final portfolio value', fmtLkr(summary.final_portfolio_value)],
    ['Trading days', String(summary.n_trading_days)],
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-400">{label}</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">{value}</p>
        </div>
      ))}
    </div>
  );
}

function AllocationTable({
  allocations,
  previousAllocations,
}: {
  allocations: Allocation[];
  previousAllocations: Allocation[] | null;
}) {
  const prevByAsset = new Map((previousAllocations ?? []).map((a) => [a.asset, a.weight]));

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-1.5">Asset</th>
            <th className="py-1.5 text-right">Weight</th>
            <th className="py-1.5 text-right">Change</th>
            <th className="py-1.5 text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {allocations.map((a) => {
            const prevWeight = prevByAsset.get(a.asset);
            const delta = prevWeight === undefined ? null : a.weight - prevWeight;
            return (
              <tr key={a.asset} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 text-slate-800">
                  {a.name} <span className="text-slate-400">({a.asset})</span>
                </td>
                <td className="py-1.5 text-right font-medium text-slate-900">
                  {(a.weight * 100).toFixed(1)}%
                </td>
                <td
                  className={`py-1.5 text-right ${
                    delta === null ? 'text-slate-300' : delta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {delta === null ? '—' : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}pp`}
                </td>
                <td className="py-1.5 text-right text-slate-500">{fmtLkr(a.value_lkr)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BacktestSection({ modelInfo }: { modelInfo: ModelInfoResponse | null }) {
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayIndex, setDayIndex] = useState(0);

  useEffect(() => {
    getPortfolioBacktest()
      .then((data) => {
        setBacktest(data);
        setDayIndex(data.days.length - 1);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Could not reach the portfolio-allocation service.'),
      )
      .finally(() => setLoading(false));
  }, []);

  const activeDay = backtest?.days[dayIndex];
  const previousDay = backtest && dayIndex > 0 ? backtest.days[dayIndex - 1] : null;

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          Loading backtest…
        </div>
      )}

      {error && (
        <div className="card border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700">{error}</div>
      )}

      {backtest && activeDay && (
        <>
          {/* {!backtest.dates_available && (
            <div className="card border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
              Trading days are labeled sequentially ("Day N"), not by calendar date - this export
              doesn't include the raw CSE history needed to reconstruct real dates.
            </div>
          )} */}

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-800">Test-set equity curve</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Portfolio value across the held-out test period - click or hover to inspect a day.
            </p>
            <div className="mt-3">
              <EquityCurve
                days={backtest.days}
                initialCapital={modelInfo?.initial_capital ?? backtest.days[0].portfolio_value}
                selectedIndex={dayIndex}
                onSelect={setDayIndex}
              />
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-800">{activeDay.label}</h3>
              <p className="text-sm font-semibold text-slate-900">{fmtLkr(activeDay.portfolio_value)}</p>
            </div>
            <input
              type="range"
              min={0}
              max={backtest.days.length - 1}
              value={dayIndex}
              onChange={(e) => setDayIndex(Number(e.target.value))}
              className="mt-3 w-full accent-brand-600"
            />
            <p className="mt-1 text-xs text-slate-400">
              Day return {fmtPct(activeDay.portfolio_return)} · transaction cost{' '}
              {fmtLkr(activeDay.total_cost)}
            </p>

            <AllocationTable
              allocations={activeDay.allocations}
              previousAllocations={previousDay?.allocations ?? null}
            />
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-800">Test-set summary</h3>
            <div className="mt-3">
              <MetricsGrid summary={backtest.summary} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const REGIME_LABELS: Record<string, string> = { bull: 'Bull', bear: 'Bear', sideways: 'Sideways' };
const REGIME_COLORS: Record<string, string> = {
  bull: 'bg-emerald-500',
  bear: 'bg-rose-500',
  sideways: 'bg-amber-500',
};

function RegimeBars({ regimeProbs }: { regimeProbs: Record<string, number> }) {
  return (
    <div className="space-y-2">
      {Object.entries(regimeProbs).map(([regime, prob]) => (
        <div key={regime}>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{REGIME_LABELS[regime] ?? regime}</span>
            <span className="font-medium text-slate-700">{(prob * 100).toFixed(1)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${REGIME_COLORS[regime] ?? 'bg-brand-500'}`}
              style={{ width: `${Math.min(100, prob * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LiveSection() {
  const [live, setLive] = useState<LiveTodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleFetch() {
    setLoading(true);
    setError(null);
    getPortfolioLiveToday()
      .then(setLive)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not reach the portfolio-allocation service.'))
      .finally(() => setLoading(false));
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Live allocation</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Fetches real CSE price history for all 10 assets and runs the trained agent now.
              This makes 10 live CSE requests, so it can take up to a minute.
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition-all hover:shadow-md hover:shadow-brand-600/40 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
            disabled={loading}
            onClick={handleFetch}
          >
            {loading ? 'Fetching + predicting…' : live ? 'Refresh' : 'Fetch live allocation'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700">{error}</div>
      )}

      {live && (
        <>
          <div className="card border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
            {live.trading_days_synthetic > 0 ? (
              <>
                Only {live.trading_days_real} of {live.trading_days_real + live.trading_days_synthetic}{' '}
                trading days in this window are real CSE data - the rest is synthetic padding (CSE's
                chart endpoint only reliably serves one recent request per asset). Treat this
                allocation as illustrative, not a real signal.
              </>
            ) : (
              <>All {live.trading_days_real} trading days in this window are real CSE data.</>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-800">
              Detected market regime <span className="text-slate-400">as of {live.as_of_date}</span>
            </h3>
            <div className="mt-3">
              <RegimeBars regimeProbs={live.regime_probs} />
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-800">Recommended allocation</h3>
            <AllocationTable allocations={live.allocations} previousAllocations={null} />
          </div>
        </>
      )}

      {!live && !loading && !error && (
        <div className="card flex min-h-[120px] items-center justify-center border-dashed text-sm text-slate-400">
          Click "Fetch live allocation" to run the model on today's real CSE data.
        </div>
      )}
    </div>
  );
}

type Tab = 'backtest' | 'live';

const TABS: { id: Tab; label: string }[] = [
  { id: 'backtest', label: 'Backtest' },
  { id: 'live', label: 'Live' },
];

export default function PortfolioAllocation() {
  const [tab, setTab] = useState<Tab>('backtest');
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);

  useEffect(() => {
    getPortfolioModelInfo()
      .then(setModelInfo)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Portfolio allocation</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Regime-aware PPO agent - allocates a 10-stock CSE banking-sector portfolio day-by-day
          from a differentiable market-regime encoder (VSN + LSTM, temporal attention, macro
          graph prior).
        </p>
      </div>

      {modelInfo && (
        <div className="card border-slate-100 bg-slate-50/60 p-4 text-xs text-slate-500">
          {modelInfo.disclaimer}
        </div>
      )}

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

      {tab === 'backtest' && <BacktestSection modelInfo={modelInfo} />}
      {tab === 'live' && <LiveSection />}
    </div>
  );
}
