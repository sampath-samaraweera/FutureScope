import { NavLink, Route, Routes } from 'react-router-dom';
import NewsImpact from './pages/NewsImpact';
import CompanySnapshot from './pages/CompanySnapshot';
import ReturnForecast from './pages/ReturnForecast';
import PortfolioAllocation from './pages/PortfolioAllocation';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
    isActive
      ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
      : 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900'
  }`;

function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            
            <span className="text-[25px] font-semibold tracking-tight text-slate-900">
              Futrure Scope
            </span>
          </div>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navLinkClass}>
              News Impact
            </NavLink>
            <NavLink to="/companies" className={navLinkClass}>
              Live Stock Prices
            </NavLink>
            <NavLink to="/forecast" className={navLinkClass}>
              Return Forecast
            </NavLink>
            <NavLink to="/portfolio" className={navLinkClass}>
              Portfolio Allocation
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <Routes>
          <Route path="/" element={<NewsImpact />} />
          <Route path="/companies" element={<CompanySnapshot />} />
          <Route path="/forecast" element={<ReturnForecast />} />
          <Route path="/portfolio" element={<PortfolioAllocation />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
