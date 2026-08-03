"""
Thin adapter from the shared cse_lib client (used by every service) to the
{date, open, high, low, close, volume} row shape this service's live-mode
endpoints expect, plus assembly into the (T, n_assets) price/volume matrices
inference.predict_weights() needs. Replaces the module's original bespoke
CSE client + a gitignored cse_token.txt -- CSE_ACCESS_TOKEN now comes from
the one shared repo-root .env (see cse_lib.env.load_shared_env), same as
every other service.

Only ONE CSE call is made per ticker, not several stitched-together ones.
The model needs ~60 trading days of lookback but a single /api/charts call
is capped at ~30 calendar days (~20 trading days) -- so this alone can't
reach 60. Fetching in sequential chunks to cover the gap was tried and
rejected: confirmed by direct testing (both here and independently in
services/return-forecast/app/live_data.py) that CSE's /api/charts reliably
serves the *first* call in a burst and 401s the next one(s), even for a
different, narrower date range -- this is a session/rate quirk, not a
"no data that old" response. Rather than fight that, this fetches the one
reliable call's worth of real data per ticker and pads the shortfall with
synthetic rows (same technique as return-forecast's _pad_raw_history) --
honest about what's real vs. fabricated via the returned real/synthetic
row counts, and it actually works.
"""
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

import pandas as pd
from cse_lib import cse_client
from cse_lib.cse_client import CHARTS_MAX_RANGE_DAYS

SYMBOL_SUFFIX = ".N0000"

# Margin under CSE's ~31-calendar-day cap on a single /api/charts request.
FETCH_WINDOW_DAYS = CHARTS_MAX_RANGE_DAYS - 2


def _parse_row(row: dict) -> dict | None:
    date_val = cse_client.extract_date(row)
    close_val = cse_client.extract_close(row)
    if date_val is None or close_val is None:
        return None
    return {
        "date": date_val,
        "open": row.get("open"),
        "high": row.get("high"),
        "low": row.get("low"),
        "close": close_val,
        "volume": row.get("shareVolume") or row.get("tradeVolume"),
    }


def fetch_symbol_history(ticker: str, from_date: datetime, to_date: datetime) -> List[dict]:
    """Daily OHLCV rows for one ticker between from_date and to_date (must be
    <= CHARTS_MAX_RANGE_DAYS apart -- CSE rejects wider single requests).
    Raises cse_client.CSEAuthError / CSEUnavailableError -- callers should
    not fall back to a made-up number."""
    symbol = f"{ticker.upper()}{SYMBOL_SUFFIX}"
    rows = cse_client.fetch_price_history(symbol, from_date, to_date)
    return [parsed for row in rows if (parsed := _parse_row(row)) is not None]


def fetch_all_history(
    tickers: List[str], from_date: datetime, to_date: datetime
) -> Dict[str, List[dict]]:
    """Fetch history for every ticker -- one CSE call per symbol (see module
    docstring for why not more)."""
    return {ticker: fetch_symbol_history(ticker, from_date, to_date) for ticker in tickers}


def _assemble_matrices(history: Dict[str, List[dict]]) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Turns {ticker: [rows]} into aligned (T, n_assets) price/volume
    DataFrames -- same shape CSEDataLoader produces from the raw training
    CSVs, so inference.predict_weights() (written against that shape) needs
    no changes. Gaps (a ticker not trading on a day another one did) are
    forward/backward-filled, mirroring CSEDataLoader.load_prices_and_volumes()."""
    price_cols, volume_cols = {}, {}
    for ticker, rows in history.items():
        if not rows:
            raise cse_client.CSEUnavailableError(f"No CSE price history returned for {ticker}.")
        df = pd.DataFrame(rows).drop_duplicates(subset="date").set_index("date")
        df.index = pd.to_datetime(df.index)
        price_cols[ticker] = df["close"].astype(float)
        volume_cols[ticker] = df["volume"].astype(float)

    price_matrix = pd.DataFrame(price_cols).sort_index().ffill().bfill()
    volume_matrix = pd.DataFrame(volume_cols).sort_index().ffill().fillna(0.0)

    valid_rows = price_matrix.notna().all(axis=1)
    return price_matrix.loc[valid_rows], volume_matrix.loc[valid_rows]


def _pad_matrices(
    prices: pd.DataFrame, volumes: pd.DataFrame, min_rows: int
) -> Tuple[pd.DataFrame, pd.DataFrame, int]:
    """If there are fewer than min_rows real trading days, prepends synthetic
    rows (before the earliest real date) so the rolling-window indicators
    can compute at all. Synthetic rows clone the earliest real row's values
    per asset with a small deterministic oscillation (not real randomness,
    so results are reproducible) -- just enough to avoid exact-zero
    variance, which would otherwise make RSI/volatility/momentum permanently
    undefined. This does NOT make the result a real forecast: the further
    short of min_rows the real input is, the more of the computed window is
    built on fabricated history rather than actual market data. Returns
    (padded_prices, padded_volumes, num_synthetic_rows_added)."""
    n_missing = min_rows - len(prices)
    if n_missing <= 0:
        return prices, volumes, 0

    anchor_date = prices.index[0]
    anchor_prices = prices.iloc[0]
    anchor_volumes = volumes.iloc[0]

    pad_index, pad_price_rows, pad_volume_rows = [], [], []
    for i in range(n_missing, 0, -1):
        wobble = 1 + 0.0006 * (((n_missing - i) % 7) - 3)
        pad_index.append(anchor_date - pd.tseries.offsets.BDay(i))
        pad_price_rows.append(anchor_prices * wobble)
        pad_volume_rows.append(anchor_volumes)

    pad_prices = pd.DataFrame(pad_price_rows, index=pad_index)
    pad_volumes = pd.DataFrame(pad_volume_rows, index=pad_index)

    padded_prices = pd.concat([pad_prices, prices]).sort_index()
    padded_volumes = pd.concat([pad_volumes, volumes]).sort_index()
    return padded_prices, padded_volumes, n_missing


def fetch_live_matrices(
    tickers: List[str], min_rows: int
) -> Tuple[pd.DataFrame, pd.DataFrame, int, int]:
    """Fetches the maximum real CSE history reachable in one call per ticker,
    pads any shortfall against min_rows, and returns
    (prices, volumes, n_real_rows, n_synthetic_rows)."""
    to_date = datetime.now()
    from_date = to_date - timedelta(days=FETCH_WINDOW_DAYS)

    history = fetch_all_history(tickers, from_date, to_date)
    prices, volumes = _assemble_matrices(history)
    n_real = len(prices)

    padded_prices, padded_volumes, n_synthetic = _pad_matrices(prices, volumes, min_rows)
    return padded_prices, padded_volumes, n_real, n_synthetic
