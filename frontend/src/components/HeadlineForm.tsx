import { useMemo, useState } from 'react';
import type { Category, PredictRequest } from '../api/types';
import { CATEGORY_LABELS, classifyCategoryPreview } from '../lib/categoryPreview';
import CompanySelector from './CompanySelector';

interface HeadlineFormProps {
  onSubmit: (payload: PredictRequest) => void;
  loading: boolean;
}

const CATEGORY_OPTIONS: Category[] = ['company_event', 'macro', 'general'];

export default function HeadlineForm({ onSubmit, loading }: HeadlineFormProps) {
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
    const payload: PredictRequest = {
      headline: headline.trim(),
      is_company_specific: isCompanySpecific,
      ...(isCompanySpecific ? { company_ticker: companyTicker } : {}),
      ...(categoryOverride ? { category: categoryOverride } : {}),
      days_since_publication: daysSincePublication,
      n_articles: nArticles,
    };
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <label htmlFor="headline" className="mb-1 block text-sm font-medium text-slate-700">
          Headline
        </label>
        <textarea
          id="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          rows={3}
          placeholder="e.g. Commercial Bank reports 18% rise in quarterly profit"
          className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Scope</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsCompanySpecific(false)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !isCompanySpecific
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Market-wide
          </button>
          <button
            type="button"
            onClick={() => setIsCompanySpecific(true)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isCompanySpecific
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Company-specific
          </button>
        </div>
      </div>

      {isCompanySpecific && (
        <CompanySelector value={companyTicker} onChange={setCompanyTicker} />
      )}

      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Detected category:</span>
        {!editingCategory ? (
          <>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
              {CATEGORY_LABELS[effectiveCategory]}
            </span>
            <button
              type="button"
              onClick={() => setEditingCategory(true)}
              className="text-xs font-medium text-slate-500 underline hover:text-slate-800"
            >
              edit
            </button>
          </>
        ) : (
          <>
            <select
              value={effectiveCategory}
              onChange={(e) => setCategoryOverride(e.target.value as Category)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
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
              className="text-xs font-medium text-slate-500 underline hover:text-slate-800"
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
          className="text-xs font-medium text-slate-500 underline hover:text-slate-800"
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
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {loading ? 'Predicting…' : 'Predict impact'}
      </button>
    </form>
  );
}
