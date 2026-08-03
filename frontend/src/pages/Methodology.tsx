interface FeatureRow {
  name: string;
  value: string;
  description: string;
}

const FEATURES: FeatureRow[] = [
  {
    name: 'Headline text',
    value: 'FinBERT → 768-dim vector',
    description: "The headline is run through FinBERT (finance-pretrained BERT); its pooled output vector is the model's main input.",
  },
  {
    name: 'Category',
    value: 'company_event / macro / general',
    description: 'One-hot encoded, plus a learned per-category time-decay rate (how fast that category\'s market impact fades).',
  },
  {
    name: 'time_since_open',
    value: 'days since publication ÷ max_gap_days, capped [0, 1]',
    description: 'How long ago the headline was published, normalized.',
  },
  {
    name: 'volatility_10d',
    value: 'stdev(last 10 daily returns) × √252',
    description: 'Annualized 10-day volatility of the company\'s stock, fetched live from CSE. For non-company-specific headlines, a fixed 20% market-wide default is used instead.',
  },
  {
    name: 'is_company_specific',
    value: '0 or 1',
    description: 'Whether the headline is about a specific bank vs. market-wide news.',
  },
  {
    name: 'is_local_source',
    value: '0 or 1',
    description: 'Whether the news source is a local (Sri Lankan) outlet.',
  },
  {
    name: 'n_articles_log',
    value: 'log(1 + article count)',
    description: 'How many articles covered this event, log-scaled.',
  },
];

export default function Methodology() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        The formula and inputs behind the prediction shown in the Predict tab.
      </p>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-800">
          What the model predicts: Cumulative Abnormal Return (CAR)
        </h3>
        <div className="mt-3 rounded-xl bg-slate-50 p-4 font-mono text-sm text-slate-700">
          <p>ARₜ = Rₜ − E[Rₜ]</p>
          <p className="mt-1">CAR = Σ ARₜ (summed over the event window after publication)</p>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Rₜ</span> is the stock's actual daily
          return, and <span className="font-medium text-slate-700">E[Rₜ]</span> is its expected
          return had the headline never happened. The difference each day is the "abnormal"
          return; summing it over the days following the headline gives CAR. This is computed
          from historical CSE price data while building the training dataset - the deployed
          model itself never computes CAR from live prices, it predicts CAR's magnitude directly
          from the headline and the market-context features below.
        </p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-800">Volatility (10-day, annualized)</h3>
        <div className="mt-3 rounded-xl bg-slate-50 p-4 font-mono text-sm text-slate-700">
          volatility_10d = stdev(last 10 daily returns) × √252
        </div>
        <p className="mt-3 text-sm text-slate-600">
          252 is the standard number of trading days in a year, used to annualize the daily
          standard deviation. Fetched live from CSE for company-specific predictions.
        </p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-800">Inputs fed to the model</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5 pr-4">Feature</th>
                <th className="py-1.5 pr-4">Computed as</th>
                <th className="py-1.5">Description</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.name} className="border-b border-slate-100 align-top last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs font-medium text-slate-800">{f.name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-500">{f.value}</td>
                  <td className="py-2 text-slate-600">{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
