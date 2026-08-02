"""
Live prediction input: fetches real daily price history for a symbol from
CSE (via shared cse_lib, the same client car-magnitude uses) and maps it
into feature_engineering's RAW_COLUMNS shape.

Only ONE CSE call is made, not several stitched-together ones. A usable
window needs ~41 trading days (MIN_WARMUP_ROWS + SEQ_LEN) but a single
/api/charts call is capped at ~30 calendar days (~20 trading days) -- so
this alone can't reach 41. Multiple sequential calls were tried and
rejected: confirmed by direct testing that CSE's /api/charts reliably
serves the *first* call in a burst and then 401s the next one(s), even
several seconds apart -- the same non-deterministic behavior documented in
cse_lib.cse_client. Rather than fight that, this fetches the one reliable
call's worth of real data and leaves the shortfall to
feature_engineering's existing, already-disclosed synthetic-padding
mechanism (see build_scaled_window / synthetic_rows_in_window in the
response) -- honest about what's real vs. fabricated, and it actually works.

Exchange Rate IS live now -- fetched from Frankfurter's CBSL-sourced USD/LKR
rate feed (api.frankfurter.dev, no auth needed). Sector_Index and
YoY_Inflation_% still have no live source wired up -- CSE's sector
endpoints (allSectors/aspiData/snpData/marketIndices, all tested directly)
only expose a current snapshot, not history, and no inflation feed is
integrated. Those two still get small deterministic day-to-day drift
instead of a flat constant -- purely so Sector_Index_Return/
Rolling_20Day_Beta (which divide by variance) don't mathematically blow up
into NaN on a zero-variance flat series. That drift is NOT real macro
data; USD_LKR_Return, computed from the real Exchange Rate below, now is.
"""
from datetime import datetime, timedelta

import pandas as pd
import requests
from cse_lib import cse_client

FETCH_WINDOW_DAYS = 30  # cse_lib.CHARTS_MAX_RANGE_DAYS -- the max one call allows
FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rates"


def fetch_live_usd_lkr_rates(from_date: datetime, to_date: datetime) -> dict[str, float]:
    """Real USD/LKR rates (CBSL-sourced, via Frankfurter, no auth) for the
    given range. Returns {YYYY-MM-DD: rate}; only has entries for days
    CBSL actually published a rate (weekdays, minus their own holidays --
    not necessarily the same holidays CSE observes)."""
    params = {
        "providers": "CBSL",
        "from": from_date.strftime("%Y-%m-%d"),
        "to": to_date.strftime("%Y-%m-%d"),
        "base": "USD",
        "quotes": "LKR",
    }
    resp = requests.get(FRANKFURTER_URL, params=params, timeout=15)
    resp.raise_for_status()
    return {row["date"]: row["rate"] for row in resp.json()}


def fetch_live_raw_history(symbol: str, min_rows: int) -> pd.DataFrame:
    """Returns a DataFrame with a 'Date' column plus all of
    feature_engineering.RAW_COLUMNS, sorted ascending. `min_rows` is
    accepted for interface symmetry with the shortfall-handling caller, but
    a single CSE call is what it is -- padding covers any gap.
    Raises ValueError if CSE returns nothing at all."""
    to_date = datetime.utcnow()
    from_date = to_date - timedelta(days=FETCH_WINDOW_DAYS)
    rows = cse_client.fetch_price_history(symbol, from_date, to_date, period=1)

    rows_by_date: dict[str, dict] = {}
    for r in rows:
        date = cse_client.extract_date(r)
        close = cse_client.extract_close(r)
        if date is None or close is None:
            continue
        rows_by_date[date] = r

    if not rows_by_date:
        raise ValueError(f"No live price history returned by CSE for '{symbol}'.")

    try:
        fx_rates = fetch_live_usd_lkr_rates(from_date, to_date)
    except requests.RequestException:
        fx_rates = {}  # exchange-rate feed being down shouldn't sink the whole prediction

    sorted_dates = sorted(rows_by_date.keys())
    last_known_fx = next(iter(fx_rates.values()), 300.0)  # fallback only if the feed is empty/down
    records = []
    for i, date in enumerate(sorted_dates):
        r = rows_by_date[date]
        # CBSL doesn't necessarily publish on every CSE trading day (different
        # holiday calendars) -- forward-fill from the last known real rate.
        last_known_fx = fx_rates.get(date, last_known_fx)
        # Deterministic drift, NOT real macro data -- see module docstring.
        wobble = 1 + 0.0004 * ((i % 7) - 3)
        records.append({
            "Date": date,
            "PRICE HIGH (Rs.)": r.get("high"),
            "PRICE LOW (Rs.)": r.get("low"),
            "CLOSE PRICE (Rs.)": r.get("close"),
            "OPEN PRICE (Rs.)": r.get("open"),
            "TRADE VOLUME (No.)": r.get("tradeVolume"),
            "SHARE VOLUME (No.)": r.get("shareVolume"),
            "TURNOVER (Rs.)": r.get("turnover"),
            "Sector_Index": 100.0 * wobble,
            "Exchange Rate": last_known_fx,
            "YoY_Inflation_%": 5.0 * wobble,
        })
    return pd.DataFrame.from_records(records)
