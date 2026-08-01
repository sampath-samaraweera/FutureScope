import { useEffect, useState } from 'react';
import { getCompanies } from '../api/client';
import type { CompanySummary } from '../api/types';

interface CompanySelectorProps {
  value: string;
  onChange: (ticker: string) => void;
}

export default function CompanySelector({ value, onChange }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCompanies()
      .then((data) => {
        if (cancelled) return;
        setCompanies(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load company list.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <label htmlFor="company-select" className="mb-1 block text-sm font-medium text-slate-700">
        Company
      </label>
      <select
        id="company-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading || companies.length === 0}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-100"
      >
        <option value="" disabled>
          {loading ? 'Loading companies…' : 'Select a company'}
        </option>
        {companies.map((c) => (
          <option key={c.ticker} value={c.ticker}>
            {c.name} ({c.ticker})
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
