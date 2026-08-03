from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

Category = Literal["company_event", "macro", "general"]


class PredictRequest(BaseModel):
    headline: str = Field(..., min_length=1)
    category: Optional[Category] = None
    is_company_specific: bool = False
    company_ticker: Optional[str] = None
    days_since_publication: float = 0
    n_articles: int = 1
    is_local_source: bool = True
    include_sentiment: bool = True

    @field_validator("headline")
    @classmethod
    def headline_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("headline must not be empty")
        return v


VolatilitySource = Literal["live", "market_default"]


class PredictResponse(BaseModel):
    predicted_car_magnitude_pct: float
    is_likely_significant: bool
    significance_cutoff_pct: float
    magnitude_note: str
    sentiment_label_UNVALIDATED: Optional[str] = None
    sentiment_score_UNVALIDATED: Optional[float] = None
    sentiment_note: Optional[str] = None
    resolved_category: Category
    resolved_volatility_10d: float
    volatility_source: VolatilitySource
    ticker_used: Optional[str] = None
    category_mismatch_warning: Optional[str] = None
    ticker_mismatch_warning: Optional[str] = None


class CompanySummary(BaseModel):
    ticker: str
    name: str
    price: Optional[float] = None
    change_pct: Optional[float] = None


class PriceHistoryPoint(BaseModel):
    date: str
    close: float


class CompanySnapshot(BaseModel):
    ticker: str
    name: str
    price: Optional[float] = None
    previous_close: Optional[float] = None
    change_pct: Optional[float] = None
    volatility_10d: Optional[float] = None
    volatility_available: bool
    volatility_error: Optional[str] = None
    price_history: list[PriceHistoryPoint] = Field(default_factory=list)
    price_history_available: bool
    price_history_error: Optional[str] = None


class ModelMetrics(BaseModel):
    """Loose passthrough - see model_metrics.json for the authoritative shape."""

    model_config = ConfigDict(extra="allow")
