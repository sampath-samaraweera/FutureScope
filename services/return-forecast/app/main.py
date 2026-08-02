import logging
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import pandas as pd
from cse_lib import cse_client
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from . import dataset
from .feature_engineering import FEATURE_COLUMNS, MIN_WARMUP_ROWS, RAW_COLUMNS, build_scaled_window
from .live_data import fetch_live_raw_history
from .model import get_model
from .schemas import (
    N_FEATURES,
    SEQ_LEN,
    DatasetPredictionRequest,
    DatasetPredictionResponse,
    LivePredictionResponse,
    LivePricePoint,
    PredictionRequest,
    PredictionResponse,
    RawHistoryPredictionRequest,
    RawHistoryPredictionResponse,
)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        get_model()
        app.state.model_loaded = True
    except Exception as exc:
        app.state.model_loaded = False
        logger.warning("Model failed to load: %s", exc)

    try:
        dataset.list_companies()
        app.state.dataset_loaded = True
    except Exception as exc:
        app.state.dataset_loaded = False
        logger.warning(
            "data/X_train_scaled.csv not loaded (%s) -- /companies, "
            "/companies/{id}/dates, and /predict-from-dataset will 503 "
            "until it's added.",
            exc,
        )
    yield


app = FastAPI(title="Hybrid RNN-BiLSTM Forecast API", lifespan=lifespan)


def _require_dataset(request):
    if not request.app.state.dataset_loaded:
        raise HTTPException(
            status_code=503,
            detail="data/X_train_scaled.csv is missing -- add it and restart the service.",
        )


def _require_model(request):
    if not request.app.state.model_loaded:
        raise HTTPException(
            status_code=503,
            detail="stock_prediction_model.pt failed to load -- check server logs and restart.",
        )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health(http_request: Request):
    return {
        "status": "ok",
        "model_loaded": http_request.app.state.model_loaded,
        "dataset_loaded": http_request.app.state.dataset_loaded,
    }


@app.get("/companies")
def companies(http_request: Request):
    _require_dataset(http_request)
    return {"companies": dataset.list_companies()}


@app.get("/companies/{company_id}/dates")
def company_dates(company_id: str, http_request: Request):
    _require_dataset(http_request)
    try:
        dates = dataset.list_valid_end_dates(company_id, SEQ_LEN)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown company_id: {company_id}")
    return {"dates": dates}


@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest, http_request: Request):
    _require_model(http_request)
    model = get_model()
    x = np.array(request.sequence, dtype="float32").reshape(1, SEQ_LEN, N_FEATURES)
    prediction = model.predict(x, verbose=0)
    return PredictionResponse(forecast=prediction[0].tolist())


@app.post("/predict-from-dataset", response_model=DatasetPredictionResponse)
def predict_from_dataset(request: DatasetPredictionRequest, http_request: Request):
    _require_dataset(http_request)
    _require_model(http_request)
    try:
        start_date, end_date, sequence = dataset.get_window(
            request.company_id, SEQ_LEN, request.end_date
        )
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown company_id: {request.company_id}")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    model = get_model()
    x = np.array(sequence, dtype="float32").reshape(1, SEQ_LEN, N_FEATURES)
    prediction = model.predict(x, verbose=0)
    return DatasetPredictionResponse(
        company_id=request.company_id,
        window_start_date=start_date,
        window_end_date=end_date,
        forecast=prediction[0].tolist(),
    )


@app.post("/predict-from-raw-history", response_model=RawHistoryPredictionResponse)
def predict_from_raw_history(request: RawHistoryPredictionRequest, http_request: Request):
    _require_model(http_request)
    raw_df = pd.DataFrame(
        [dict(zip(RAW_COLUMNS, row.values), Date=row.date) for row in request.rows]
    )

    try:
        sequence, start_date, end_date, rows_used, synthetic_in_window, real_rows, last_close_price = (
            build_scaled_window(raw_df, FEATURE_COLUMNS, SEQ_LEN, allow_padding=request.allow_padding)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    model = get_model()
    x = np.array(sequence, dtype="float32").reshape(1, SEQ_LEN, N_FEATURES)
    prediction = model.predict(x, verbose=0)
    forecast = prediction[0].tolist()
    predicted_price = [last_close_price * (1 + r) for r in forecast]
    return RawHistoryPredictionResponse(
        company_id=request.company_id,
        window_start_date=start_date,
        window_end_date=end_date,
        rows_used_for_scaling=rows_used,
        real_rows_provided=real_rows,
        synthetic_rows_in_window=synthetic_in_window,
        last_close_price=last_close_price,
        forecast=forecast,
        predicted_price=predicted_price,
    )


@app.get("/predict-live/{symbol}", response_model=LivePredictionResponse)
def predict_live(symbol: str, http_request: Request):
    """Fetches real price history for `symbol` from CSE and predicts from
    it -- no dataset, no client-supplied rows. Sector_Index/Exchange Rate/
    YoY_Inflation_% are NOT live (no source wired up yet); see live_data.py."""
    _require_model(http_request)
    try:
        raw_df = fetch_live_raw_history(symbol, MIN_WARMUP_ROWS + SEQ_LEN)
    except cse_client.CSEAuthError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except cse_client.CSEUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    price_history = [
        LivePricePoint(
            date=row["Date"],
            open=row["OPEN PRICE (Rs.)"],
            high=row["PRICE HIGH (Rs.)"],
            low=row["PRICE LOW (Rs.)"],
            close=row["CLOSE PRICE (Rs.)"],
            trade_volume=row["TRADE VOLUME (No.)"],
            share_volume=row["SHARE VOLUME (No.)"],
            turnover=row["TURNOVER (Rs.)"],
        )
        for row in raw_df.to_dict(orient="records")
    ]

    try:
        sequence, start_date, end_date, rows_used, synthetic_in_window, real_rows, last_close_price = (
            build_scaled_window(raw_df, FEATURE_COLUMNS, SEQ_LEN, allow_padding=True)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    model = get_model()
    x = np.array(sequence, dtype="float32").reshape(1, SEQ_LEN, N_FEATURES)
    prediction = model.predict(x, verbose=0)
    forecast = prediction[0].tolist()
    predicted_price = [last_close_price * (1 + r) for r in forecast]
    return LivePredictionResponse(
        company_id=symbol,
        window_start_date=start_date,
        window_end_date=end_date,
        rows_used_for_scaling=rows_used,
        real_rows_provided=real_rows,
        synthetic_rows_in_window=synthetic_in_window,
        last_close_price=last_close_price,
        forecast=forecast,
        predicted_price=predicted_price,
        price_history=price_history,
    )
