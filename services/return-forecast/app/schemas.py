from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

from .feature_engineering import RAW_COLUMNS

SEQ_LEN = 20
N_FEATURES = 45
FORECAST_HORIZON = 5


class PredictionRequest(BaseModel):
    sequence: List[List[float]] = Field(
        ...,
        description=(
            f"Window of {SEQ_LEN} timesteps, each with {N_FEATURES} feature "
            "values, in the same feature order used during training."
        ),
    )

    @field_validator("sequence")
    @classmethod
    def validate_shape(cls, value: List[List[float]]) -> List[List[float]]:
        if len(value) != SEQ_LEN:
            raise ValueError(f"sequence must contain exactly {SEQ_LEN} timesteps, got {len(value)}")
        for i, step in enumerate(value):
            if len(step) != N_FEATURES:
                raise ValueError(
                    f"timestep {i} must contain exactly {N_FEATURES} features, got {len(step)}"
                )
        return value


class PredictionResponse(BaseModel):
    forecast: List[float] = Field(
        ..., description=f"Predicted values for the next {FORECAST_HORIZON} days."
    )


class DatasetPredictionRequest(BaseModel):
    company_id: str = Field(..., description="Ticker/company id as it appears in the training dataset.")
    end_date: Optional[str] = Field(
        None,
        description="YYYY-MM-DD. The 20-day window ending on this date is used. "
        "If omitted, the most recent available date for the company is used.",
    )


class DatasetPredictionResponse(BaseModel):
    company_id: str
    window_start_date: str
    window_end_date: str
    forecast: List[float] = Field(
        ...,
        description=(
            f"Predicted return (fractional, e.g. 0.02 = +2%) for t+1 through "
            f"t+{FORECAST_HORIZON} trading days after window_end_date."
        ),
    )


class RawHistoryRow(BaseModel):
    date: str = Field(..., description="YYYY-MM-DD")
    values: List[float] = Field(
        ..., description=f"{len(RAW_COLUMNS)} raw values in order: {RAW_COLUMNS}"
    )

    @field_validator("values")
    @classmethod
    def validate_values(cls, value: List[float]) -> List[float]:
        if len(value) != len(RAW_COLUMNS):
            raise ValueError(f"values must contain exactly {len(RAW_COLUMNS)} numbers, got {len(value)}")
        return value


class RawHistoryPredictionRequest(BaseModel):
    company_id: str = Field(..., description="Label only; used in the response, not looked up anywhere.")
    rows: List[RawHistoryRow] = Field(
        ...,
        description=(
            "Raw daily rows for a single company, sorted or unsorted (sorted by date "
            "server-side). If there's not enough history for indicators to warm up, "
            "missing days are auto-padded with fabricated rows -- see allow_padding."
        ),
    )
    allow_padding: bool = Field(
        True,
        description=(
            "If the supplied rows are short of the ~41 needed, auto-fill the gap with "
            "synthetic rows so a number can still be produced. When True, the response "
            "flags how much of the result relies on fabricated (non-real) history."
        ),
    )


class RawHistoryPredictionResponse(BaseModel):
    company_id: str
    window_start_date: str
    window_end_date: str
    rows_used_for_scaling: int = Field(
        ..., description="How many fully warmed-up engineered rows the per-company scaler was fit on."
    )
    real_rows_provided: int = Field(..., description="How many rows you actually supplied.")
    synthetic_rows_in_window: int = Field(
        ...,
        description=(
            f"Of the {SEQ_LEN} timesteps fed to the model, how many are fabricated padding "
            "rather than your real data. 0 means the forecast is based entirely on real "
            "input; a high number means treat the forecast as a rough demo value only."
        ),
    )
    last_close_price: float = Field(
        ..., description="Actual CLOSE PRICE (Rs.) on window_end_date -- the base price the returns apply to."
    )
    forecast: List[float] = Field(
        ...,
        description=(
            f"Predicted return (fractional, e.g. 0.02 = +2%) for t+1 through "
            f"t+{FORECAST_HORIZON} trading days after window_end_date."
        ),
    )
    predicted_price: List[float] = Field(
        ...,
        description=(
            "forecast converted to Rs., via last_close_price * (1 + return), "
            "for t+1 through t+5."
        ),
    )


class LivePricePoint(BaseModel):
    date: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    trade_volume: Optional[float] = None
    share_volume: Optional[float] = None
    turnover: Optional[float] = None
    exchange_rate: Optional[float] = Field(
        None, description="Real USD/LKR rate (CBSL, via Frankfurter) for this date -- live, not fabricated."
    )


class LivePredictionResponse(RawHistoryPredictionResponse):
    price_history: List[LivePricePoint] = Field(
        ...,
        description=(
            "The actual daily rows fetched live from CSE for this symbol "
            "(oldest to newest) -- what the prediction above was computed "
            "from. Sector_Index/Exchange Rate/YoY_Inflation_% are NOT live "
            "(no source wired up) and are deliberately not shown here since "
            "they aren't real data."
        ),
    )
