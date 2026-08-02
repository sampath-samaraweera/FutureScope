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

Sector_Index, Exchange Rate, and YoY_Inflation_% have NO live source wired
up (CSE's public endpoints don't expose them, and no Central Bank/inflation
feed is integrated). Small deterministic day-to-day drift is used instead
of a flat constant -- purely so Sector_Index_Return/USD_LKR_Return/
Rolling_20Day_Beta (which divide by variance) don't mathematically blow up
into NaN on a zero-variance flat series. This is NOT real macro data --
predictions using it should be treated as a rough demo, not a real macro
picture. Replace with a real live source when one is found.
"""
from datetime import datetime, timedelta

import pandas as pd
from cse_lib import cse_client

FETCH_WINDOW_DAYS = 30  # cse_lib.CHARTS_MAX_RANGE_DAYS -- the max one call allows


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

    sorted_dates = sorted(rows_by_date.keys())
    records = []
    for i, date in enumerate(sorted_dates):
        r = rows_by_date[date]
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
            "Exchange Rate": 300.0 * wobble,
            "YoY_Inflation_%": 5.0 * wobble,
        })
    return pd.DataFrame.from_records(records)
