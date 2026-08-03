import { useState } from 'react';
import Home from './Home';
import Methodology from './Methodology';
import Validation from './Validation';

type Tab = 'predict' | 'validation' | 'methodology';

const TABS: { id: Tab; label: string }[] = [
  { id: 'predict', label: 'Predict' },
  { id: 'validation', label: 'Validation' },
  { id: 'methodology', label: 'Formula & Inputs' },
];

export default function NewsImpact() {
  const [tab, setTab] = useState<Tab>('predict');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">News impact</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Predict how a headline will move a bank stock, and see the evidence behind the model.
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

      {tab === 'predict' && <Home />}
      {tab === 'validation' && <Validation />}
      {tab === 'methodology' && <Methodology />}
    </div>
  );
}
