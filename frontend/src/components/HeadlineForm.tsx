import { useMemo, useState } from 'react';
import type { Category, PredictRequest } from '../api/types';
import { CATEGORY_LABELS, classifyCategoryPreview } from '../lib/categoryPreview';
import { EXAMPLE_HEADLINES } from '../lib/exampleHeadlines';
import CompanySelector from './CompanySelector';

interface HeadlineFormProps {
  onSubmit: (payload: PredictRequest, actualCarPct?: number) => void;
  loading: boolean;
}

const CATEGORY_OPTIONS: Category[] = ['company_event', 'macro', 'general'];

export default function HeadlineForm({ onSubmit, loading }: HeadlineFormProps) {
  const [useCustom, setUseCustom] = useState(false);
  const [exampleIndex, setExampleIndex] = useState<number | null>(null);
  const [headline, setHeadline] = useState('');
  const [isCompanySpecific, setIsCompanySpecific] = useState(false);
  const [companyTicker, setCompanyTicker] = useState('');
  const [categoryOverride, setCategoryOverride] = useState<Category | null>(null);
  const [editingCategory, setEditingCategory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [daysSincePublication, setDaysSincePublication] = useState(0);
  const [nArticles, setNArticles] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

  const detectedCategory = useMemo(
    () => classifyCategoryPreview(headline, isCompanySpecific),
    [headline, isCompanySpecific],
  );
  const effectiveCategory = categoryOverride ?? detectedCategory;

  function buildPayload(): PredictRequest {
    return {
      headline: headline.trim(),
      is_company_specific: isCompanySpecific,
      ...(isCompanySpecific ? { company_ticker: companyTicker } : {}),
      ...(categoryOverride ? { category: categoryOverride } : {}),
      days_since_publication: daysSincePublication,
      n_articles: nArticles,
    };
  }

  function handleExampleSelect(indexStr: string) {
    const index = indexStr === '' ? null : Number(indexStr);
    setExampleIndex(index);
    if (index === null) return;
    const example = EXAMPLE_HEADLINES[index];
    setHeadline(example.headline);
    setIsCompanySpecific(example.isCompanySpecific);
    setCompanyTicker(example.companyTicker ?? '');
    setCategoryOverride(null);
    setFormError(null);
    onSubmit(
      {
        headline: example.headline,
        is_company_specific: example.isCompanySpecific,
        ...(example.isCompanySpecific ? { company_ticker: example.companyTicker } : {}),
        days_since_publication: daysSincePublication,
        n_articles: nArticles,
      },
      example.actualCarPct,
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!headline.trim()) {
      setFormError('Enter a headline first.');
      return;
    }
    if (isCompanySpecific && !companyTicker) {
      setFormError('Pick a company, or switch to Market-wide.');
      return;
    }
    setFormError(null);
    onSubmit(buildPayload(), useCustom ? undefined : EXAMPLE_HEADLINES[exampleIndex ?? -1]?.actualCarPct);
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-5">
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
        <span
          role="checkbox"
          aria-checked={useCustom}
          tabIndex={0}
          onClick={() => {
            const next = !useCustom;
            setUseCustom(next);
            setFormError(null);
            if (next) {
              setHeadline('');
              setIsCompanySpecific(false);
              setCompanyTicker('');
              setExampleIndex(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.currentTarget.click();
            }
          }}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            useCustom ? 'bg-brand-600' : 'bg-slate-200'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              useCustom ? 'translate-x-[1.125rem]' : 'translate-x-1'
            }`}
          />
        </span>
        Enter my own headline
      </label>

      {!useCustom ? (
        <div>
          <label htmlFor="example-select" className="mb-1 block text-sm font-medium text-slate-700">
            Example headline (real, from the test set)
          </label>
          <select
            id="example-select"
            value={exampleIndex ?? ''}
            onChange={(e) => handleExampleSelect(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="" disabled>
              Select a headline…
            </option>
            {EXAMPLE_HEADLINES.map((ex, i) => (
              <option key={i} value={i}>
                {ex.headline}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label htmlFor="headline" className="mb-1 block text-sm font-medium text-slate-700">
            Headline
          </label>
          <textarea
            id="headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />

          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium text-slate-700">Scope</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsCompanySpecific(false)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                  !isCompanySpecific
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Market-wide
              </button>
              <button
                type="button"
                onClick={() => setIsCompanySpecific(true)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                  isCompanySpecific
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Company-specific
              </button>
            </div>
          </div>

          {isCompanySpecific && (
            <div className="mt-4">
              <CompanySelector value={companyTicker} onChange={setCompanyTicker} />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Detected category:</span>
        {!editingCategory ? (
          <>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-medium text-brand-700">
              {CATEGORY_LABELS[effectiveCategory]}
            </span>
            <button
              type="button"
              onClick={() => setEditingCategory(true)}
              className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
            >
              edit
            </button>
          </>
        ) : (
          <>
            <select
              value={effectiveCategory}
              onChange={(e) => setCategoryOverride(e.target.value as Category)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setCategoryOverride(null);
                setEditingCategory(false);
              }}
              className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
            >
              reset to auto
            </button>
          </>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
        >
          {showAdvanced ? 'Hide advanced options' : 'Advanced options'}
        </button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="days-since" className="mb-1 block text-xs font-medium text-slate-600">
                Days since publication
              </label>
              <input
                id="days-since"
                type="number"
                min={0}
                value={daysSincePublication}
                onChange={(e) => setDaysSincePublication(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="n-articles" className="mb-1 block text-xs font-medium text-slate-600">
                Related article count
              </label>
              <input
                id="n-articles"
                type="number"
                min={1}
                value={nArticles}
                onChange={(e) => setNArticles(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {formError && <p className="text-sm text-rose-600">{formError}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition-all hover:shadow-md hover:shadow-brand-600/40 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
      >
        {loading ? 'Predicting…' : 'Predict impact'}
      </button>
    </form>
  );
}
