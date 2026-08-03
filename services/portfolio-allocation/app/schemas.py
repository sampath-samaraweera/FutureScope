from typing import Dict, List, Optional

from pydantic import BaseModel


class AssetInfo(BaseModel):
    ticker: str
    name: str


class ModelInfoResponse(BaseModel):
    assets: List[AssetInfo]
    initial_capital: float
    disclaimer: str


class Allocation(BaseModel):
    asset: str
    name: str
    weight: float
    value_lkr: float


class BacktestDay(BaseModel):
    index: int
    label: str
    portfolio_value: float
    portfolio_return: float
    total_cost: float
    allocations: List[Allocation]


class BacktestSummary(BaseModel):
    total_return: float
    annual_return: float
    annual_volatility: float
    sharpe_ratio: float
    max_drawdown: float
    total_transaction_costs: float
    final_portfolio_value: float
    n_trading_days: int


class BacktestResponse(BaseModel):
    asset_names: List[str]
    dates_available: bool
    days: List[BacktestDay]
    summary: BacktestSummary


class LiveTodayResponse(BaseModel):
    as_of_date: str
    trading_days_real: int
    trading_days_synthetic: int
    allocations: List[Allocation]
    regime_probs: Dict[str, float]
