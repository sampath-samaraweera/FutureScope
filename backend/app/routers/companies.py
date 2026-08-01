from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, HTTPException

from .. import cse_client
from ..schemas import CompanySnapshot, CompanySummary, PriceHistoryPoint

router = APIRouter(tags=["companies"])


@router.get("/companies", response_model=List[CompanySummary])
def list_companies():
    try:
        rows = cse_client.fetch_trade_summary()
    except cse_client.CSEUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return [
        {
            "ticker": r["symbol"],
            "name": r["name"],
            "price": r.get("price"),
            "change_pct": r.get("percentageChange"),
        }
        for r in rows
        if r.get("symbol") and cse_client.is_bank_name(r.get("name", ""))
    ]


@router.get("/companies/{ticker}", response_model=CompanySnapshot)
def company_snapshot(ticker: str):
    try:
        info = cse_client.fetch_company_info(ticker)
    except cse_client.CSEUnavailableError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    symbol_info = info.get("reqSymbolInfo", {})
    company_name = symbol_info.get("name", ticker)
    if not cse_client.is_bank_name(company_name):
        raise HTTPException(
            status_code=400,
            detail=f"'{ticker}' ({company_name}) is outside this project's scope -- only banks are supported.",
        )

    snapshot = {
        "ticker": ticker,
        "name": company_name,
        "price": symbol_info.get("lastTradedPrice"),
        "previous_close": symbol_info.get("previousClose"),
        "change_pct": None,
        "volatility_10d": None,
        "volatility_available": False,
        "volatility_error": None,
        "price_history": [],
        "price_history_available": False,
        "price_history_error": None,
    }
    price = symbol_info.get("lastTradedPrice")
    prev = symbol_info.get("previousClose")
    if price is not None and prev:
        snapshot["change_pct"] = round((price - prev) / prev * 100, 3)

    try:
        volatility = cse_client.compute_volatility_10d(ticker)
        snapshot["volatility_10d"] = volatility
        snapshot["volatility_available"] = True
    except (cse_client.CSEAuthError, cse_client.CSEUnavailableError) as exc:
        snapshot["volatility_error"] = str(exc)

    try:
        to_date = datetime.utcnow()
        from_date = to_date - timedelta(days=cse_client.CHARTS_MAX_RANGE_DAYS)
        rows = cse_client.fetch_price_history(ticker, from_date, to_date, period=1)
        history = []
        for r in rows:
            close = cse_client.extract_close(r)
            date = cse_client.extract_date(r)
            if close is not None and date is not None:
                history.append(PriceHistoryPoint(date=date, close=close))
        snapshot["price_history"] = history
        snapshot["price_history_available"] = True
    except (cse_client.CSEAuthError, cse_client.CSEUnavailableError) as exc:
        snapshot["price_history_error"] = str(exc)

    return snapshot
