import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Validation from './pages/Validation';
import CompanySnapshot from './pages/CompanySnapshot';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-slate-900 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-slate-900">
            CSE News-Impact Predictor
          </span>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Predict
            </NavLink>
            <NavLink to="/validation" className={navLinkClass}>
              Validation
            </NavLink>
            <NavLink to="/companies" className={navLinkClass}>
              Company Snapshot
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/validation" element={<Validation />} />
          <Route path="/companies" element={<CompanySnapshot />} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-6 text-xs text-slate-400">
        Company list, prices, and volatility are fetched live from the CSE API.
      </footer>
    </div>
  );
}

export default App;
