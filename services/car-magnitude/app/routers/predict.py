from cse_lib import cse_client
from cse_lib.category import CATEGORY_LABELS, classify_category_v2
from cse_lib.validation import is_gibberish, ticker_mentioned_in_headline
from fastapi import APIRouter, HTTPException, Request

from ..schemas import PredictRequest, PredictResponse

router = APIRouter(tags=["predict"])

# Used only for market-wide (not company-specific) predictions, where the
# model's volatility_10d feature has no single company to anchor to. This is
# a documented static assumption, not a live measurement -- CSE has no
# public "index volatility" endpoint wired in here. See README.
MARKET_WIDE_DEFAULT_VOLATILITY_10D = 0.20


@router.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest, request: Request):
    predictor = request.app.state.predictor
    if predictor is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Model is not loaded. Place model_weights.pt and "
                "model_config.json in backend/app/ and restart the server."
            ),
        )

    if is_gibberish(payload.headline):
        raise HTTPException(
            status_code=400,
            detail=(
                "This doesn't look like a real headline (too short, too few "
                "words, or repeated characters). Enter an actual news headline."
            ),
        )

    ticker_used = None
    ticker_mismatch_warning = None
    if payload.is_company_specific:
        if not payload.company_ticker:
            raise HTTPException(
                status_code=400,
                detail="company_ticker is required when is_company_specific is true",
            )
        ticker_used = payload.company_ticker
        try:
            companies_by_ticker = {
                r["symbol"]: r["name"] for r in cse_client.fetch_trade_summary() if r.get("symbol")
            }
        except cse_client.CSEUnavailableError as exc:
            raise HTTPException(status_code=502, detail=f"Could not verify ticker against CSE: {exc}") from exc

        company_name = companies_by_ticker.get(ticker_used)
        if company_name is None:
            raise HTTPException(status_code=400, detail=f"Unknown company_ticker '{ticker_used}'")
        if not cse_client.is_bank_name(company_name):
            raise HTTPException(
                status_code=400,
                detail=f"'{ticker_used}' ({company_name}) is outside this project's scope -- only banks are supported.",
            )

        if not ticker_mentioned_in_headline(payload.headline, ticker_used, company_name):
            ticker_mismatch_warning = (
                f"The headline doesn't appear to mention {company_name} -- "
                "double check you selected the right company."
            )

        try:
            volatility_10d = cse_client.compute_volatility_10d(ticker_used)
            volatility_source = "live"
        except cse_client.CSEAuthError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except cse_client.CSEUnavailableError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not fetch live volatility for '{ticker_used}': {exc}",
            ) from exc
    else:
        volatility_10d = MARKET_WIDE_DEFAULT_VOLATILITY_10D
        volatility_source = "market_default"

    auto_detected_category = classify_category_v2(payload.headline, is_company=payload.is_company_specific)
    category_mismatch_warning = None
    if payload.category and payload.category != auto_detected_category:
        category_mismatch_warning = (
            f"You selected '{CATEGORY_LABELS[payload.category]}', but this headline "
            f"auto-detects as '{CATEGORY_LABELS[auto_detected_category]}' -- results "
            "may not reflect what you intend."
        )
    category = payload.category or auto_detected_category

    result = predictor.predict(
        headline=payload.headline,
        category=category,
        is_company_specific=int(payload.is_company_specific),
        is_local_source=int(payload.is_local_source),
        volatility_10d=volatility_10d,
        days_since_publication=payload.days_since_publication,
        n_articles=payload.n_articles,
        include_sentiment=payload.include_sentiment,
    )
    result["resolved_category"] = category
    result["resolved_volatility_10d"] = volatility_10d
    result["volatility_source"] = volatility_source
    result["ticker_used"] = ticker_used
    result["category_mismatch_warning"] = category_mismatch_warning
    result["ticker_mismatch_warning"] = ticker_mismatch_warning
    return result
