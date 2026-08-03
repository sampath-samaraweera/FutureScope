import { useEffect, useState } from 'react';
import { getModelMetrics, plotUrl } from '../api/client';
import type { ModelMetrics } from '../api/types';
import PRCurveChart from '../components/PRCurveChart';
import { ABLATION_PLOTS } from '../lib/ablationPlots';

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
      <p className="text-sm text-slate-500">
        This model predicts <strong className="text-slate-700">magnitude</strong> only, not
        direction - direction was tested during training and found unlearnable from headline
        text alone. What follows is the evidence for the magnitude prediction only.
      </p>

      {/* <div className="card border-slate-100 bg-slate-50/60 p-5 text-sm text-slate-600">
        <p className="font-semibold text-slate-700">Known limitations</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Predicts reaction magnitude only - direction is not modeled (see above).</li>
          <li>
            The sentiment badge shown alongside predictions is a separate, off-the-shelf
            heuristic never validated against this dataset's true CAR direction - treat it as
            informal color, not evidence.
          </li>
          <li>
            <strong className="text-slate-700">Limited sensitivity to specific numeric values in headline text</strong> -
            <strong className="text-slate-700">Limited sensitivity to specific numeric values in headline text</strong> -
            e.g. changing a bond issuance from "$750m" to "$10000m" produces only a small change
            in predicted magnitude. This is a known, structural limitation of BERT-style text
            encoders (they're weak at extracting and reasoning about numeric magnitudes from raw
            text), not something specific to this implementation - confirmed by manual testing
            during development.
          </li>
        </ul>
      </div> */}

      {error && (
        <div className="card border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700">{error}</div>
      )}

      {metrics?._placeholder && (
        <div className="card border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800">
          <strong>Placeholder data.</strong>{' '}
          {metrics.note ?? 'The model is still training - these are not real validated numbers.'}
        </div>
      )}

      {metrics && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {rows.map(([label, value, digits]) => (
              <div key={label} className="card p-4">
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  {fmt(value, digits ?? 3)}
                </p>
              </div>
            ))}
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

      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Architecture &amp; ablation studies
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Supplementary experiments backing individual design decisions -- pooling, fusion,
          encoder freeze depth, LoRA, and more -- separate from the overall test-set metrics
          above.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ABLATION_PLOTS.map((plot) => (
          <div key={plot.id} className="card p-5">
            <h3 className="text-sm font-semibold text-slate-800">{plot.title}</h3>
            <div className="mt-3 flex min-h-[220px] items-center justify-center rounded-xl bg-slate-50">
              <img
                src={plotUrl(`/static/plots/${encodeURIComponent(plot.file)}`)}
                alt={plot.title}
                className="max-h-80 w-full object-contain"
              />
            </div>
            <p className="mt-3 text-sm text-slate-600">{plot.finding}</p>
            <p className="mt-2 border-l-2 border-brand-200 pl-3 text-xs italic text-slate-500">
              {/* “{plot.sayThis}” */}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
