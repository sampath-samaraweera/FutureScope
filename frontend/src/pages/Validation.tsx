import { useEffect, useState } from 'react';
import { getModelMetrics, plotUrl } from '../api/client';
import type { ModelMetrics } from '../api/types';
import PRCurveChart from '../components/PRCurveChart';

function fmt(value: unknown, digits = 3): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

export default function Validation() {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getModelMetrics()
      .then(setMetrics)
      .catch(() => setError('Could not load model metrics from the API.'));
  }, []);

  const rows: [string, unknown, number?][] = metrics
    ? [
        ['RMSE', metrics.rmse],
        ['R²', metrics.r2],
        ['Pearson correlation', metrics.pearson],
        ['Spearman correlation', metrics.spearman],
        ['PR-AUC', metrics.pr_auc],
        ['PR-AUC (baseline)', metrics.pr_auc_baseline],
        ['Significance cutoff (%)', metrics.significance_cutoff_pct, 2],
        ['Test samples', metrics.n_test_samples, 0],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Model validation</h1>
        <p className="mt-1 text-sm text-slate-500">
          This model predicts the <strong>magnitude</strong> of a market reaction, not its
          direction — direction was tested during training and found unlearnable from headline
          text alone. What follows is the evidence for the magnitude prediction only.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Known limitations</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Predicts reaction magnitude only — direction is not modeled (see above).</li>
          <li>
            The sentiment badge shown alongside predictions is a separate, off-the-shelf
            heuristic never validated against this dataset's true CAR direction — treat it as
            informal color, not evidence.
          </li>
          <li>
            <strong>Limited sensitivity to specific numeric values in headline text</strong> —
            e.g. changing a bond issuance from "$750m" to "$10000m" produces only a small change
            in predicted magnitude. This is a known, structural limitation of BERT-style text
            encoders (they're weak at extracting and reasoning about numeric magnitudes from raw
            text), not something specific to this implementation — confirmed by manual testing
            during development.
          </li>
        </ul>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {metrics?._placeholder && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Placeholder data.</strong> {metrics.note ?? 'The model is still training — these are not real validated numbers.'}
        </div>
      )}

      {metrics && (
        <>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <tbody>
                {rows.map(([label, value, digits]) => (
                  <tr key={label} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-600">{label}</td>
                    <td className="px-4 py-2.5 text-right text-slate-900">
                      {fmt(value, digits ?? 3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PRCurveChart
              title="Predicted vs Actual CAR"
              src={plotUrl(metrics.plots?.predicted_vs_actual)}
              description="Test-set predicted magnitude vs. actual cumulative abnormal return."
            />
            <PRCurveChart
              title="Precision-Recall Curve"
              src={plotUrl(metrics.plots?.pr_curve)}
              description="Significance-flag precision/recall vs. the random baseline."
            />
          </div>
        </>
      )}
    </div>
  );
}
