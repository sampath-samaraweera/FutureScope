export interface PortfolioApiErrorBody {
  detail?: string;
}

export interface PortfolioAsset {
  ticker: string;
  name: string;
}

export interface ModelInfoResponse {
  assets: PortfolioAsset[];
  initial_capital: number;
  disclaimer: string;
}

export interface Allocation {
  asset: string;
  name: string;
  weight: number;
  value_lkr: number;
}

export interface BacktestDay {
  index: number;
  label: string;
  portfolio_value: number;
  portfolio_return: number;
  total_cost: number;
  allocations: Allocation[];
}

export interface BacktestSummary {
  total_return: number;
  annual_return: number;
  annual_volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
  total_transaction_costs: number;
  final_portfolio_value: number;
  n_trading_days: number;
}

export interface BacktestResponse {
  asset_names: string[];
  dates_available: boolean;
  days: BacktestDay[];
  summary: BacktestSummary;
}

export interface LiveTodayResponse {
  as_of_date: string;
  trading_days_real: number;
  trading_days_synthetic: number;
  allocations: Allocation[];
  regime_probs: Record<string, number>;
}
