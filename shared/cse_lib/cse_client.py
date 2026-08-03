"""
Client for the Colombo Stock Exchange's undocumented web API (www.cse.lk/api/*).

Two endpoints are genuinely public (verified by direct testing -- no cookies,
no auth headers, respond 200 with real data):

  POST /api/tradeSummary        -- today's summary for every listed company
                                    (symbol, name, price, change, volume, ...)
  POST /api/companyInfoSummery  -- per-symbol detail (today/prev close, wtd/
                                    mtd/ytd/52wk high-low, turnover, ...)

One endpoint requires a logged-in session token that can't be obtained any
other way than actually logging into cse.lk yourself (see README for why we
don't automate that login):

  POST /api/charts              -- daily OHLC-ish price history for a symbol,
                                    needed to compute a rolling volatility.
                                    Requires the `accessToken` cookie from an
                                    active cse.lk browser session. Set it as
                                    CSE_ACCESS_TOKEN in backend/.env; refresh
                                    it there whenever it stops working. Also
                                    rejects (401/417) date ranges wider than
                                    ~31 calendar days -- see CHARTS_MAX_RANGE_DAYS.

If CSE_ACCESS_TOKEN is missing or has expired, functions that need it raise
CSEAuthError with a message suitable for surfacing straight to the API caller
-- callers should not fall back to a made-up number.
"""
import os
import re
from datetime import datetime, timedelta

import requests

BASE_URL = "https://www.cse.lk"
TRADE_SUMMARY_URL = f"{BASE_URL}/api/tradeSummary"
COMPANY_INFO_URL = f"{BASE_URL}/api/companyInfoSummery"
CHARTS_URL = f"{BASE_URL}/api/charts"

COMMON_HEADERS = {
    "Accept": "application/json",
    "Origin": BASE_URL,
    "Referer": BASE_URL,
    "User-Agent": "Mozilla/5.0",
}

REQUEST_TIMEOUT = 15
ANN_FACTOR = 252  # trading days/year -- must match prepare_dataset_v6.py's ANN_FACTOR
VOL_WINDOW = 10    # must match the volatility_10d feature the model was trained on

# /api/charts rejects ranges over ~31 days; keep a margin. Still >20 trading
# days, plenty for VOL_WINDOW.
CHARTS_MAX_RANGE_DAYS = 30

_BANK_NAME_RE = re.compile(r"\bBANK(ING)?\b", re.I)


def is_bank_name(company_name: str) -> bool:
    """Whether a CSE-listed company's name identifies it as a bank -- used to
    scope the app to the banking sector (the project's focus), driven off the
    live company list rather than a hardcoded ticker list."""
    return bool(_BANK_NAME_RE.search(company_name))


class CSEAuthError(Exception):
    """Raised when a CSE endpoint needs the (expired/missing) session token."""


class CSEUnavailableError(Exception):
    """Raised on network failure or an unexpected response shape from CSE."""


def get_access_token() -> str | None:
    return os.environ.get("CSE_ACCESS_TOKEN") or None


def fetch_trade_summary() -> list[dict]:
    """All listed companies' today summary. Public endpoint, no auth needed."""
    try:
        resp = requests.post(
            TRADE_SUMMARY_URL, headers=COMMON_HEADERS, data={}, timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        raise CSEUnavailableError(f"Could not reach CSE tradeSummary: {exc}") from exc

    rows = data.get("reqTradeSummery")
    if rows is None:
        raise CSEUnavailableError("CSE tradeSummary response shape has changed (no reqTradeSummery key)")

    return rows


def fetch_company_info(symbol: str) -> dict:
    """Per-symbol detail. Public endpoint, no auth needed."""
    try:
        resp = requests.post(
            COMPANY_INFO_URL, headers=COMMON_HEADERS, data={"symbol": symbol}, timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        raise CSEUnavailableError(f"Could not reach CSE companyInfoSummery: {exc}") from exc

    if not data.get("reqSymbolInfo"):
        raise CSEUnavailableError(f"No CSE company info returned for '{symbol}'")

    return data


def fetch_price_history(symbol: str, from_date: datetime, to_date: datetime, period: int = 1) -> list[dict]:
    """
    Daily price history for `symbol` between from_date/to_date. Requires
    CSE_ACCESS_TOKEN; raises CSEAuthError if missing/invalid. Response is a
    bare JSON array of {open, high, low, close, turnover, shareVolume,
    tradeVolume, tradeDate} (tradeDate = epoch ms), newest-first. Keep
    (to_date - from_date) under CHARTS_MAX_RANGE_DAYS.
    """
    token = get_access_token()
    if not token:
        raise CSEAuthError(
            "CSE_ACCESS_TOKEN is not set in backend/.env. Log into cse.lk in a "
            "browser, copy the 'accessToken' cookie value (DevTools -> "
            "Application -> Cookies -> https://www.cse.lk), and set "
            "CSE_ACCESS_TOKEN in backend/.env, then restart the backend."
        )

    headers = {
        "Accept": "application/json",
        "Origin": BASE_URL,
        "Referer": f"{BASE_URL}/company-profile?symbol={symbol}",
        "User-Agent": "Mozilla/5.0",
    }
    session = requests.Session()
    session.cookies.set("accessToken", token)
    try:
        resp = session.post(
            CHARTS_URL,
            headers=headers,
            data={
                "symbol": symbol,
                "fromDate": from_date.strftime("%d-%m-%Y"),
                "toDate": to_date.strftime("%d-%m-%Y"),
                "period": str(period),
            },
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise CSEUnavailableError(f"Could not reach CSE charts endpoint: {exc}") from exc

    if resp.status_code in (401, 403, 417):
        raise CSEAuthError(
            f"CSE rejected this request (HTTP {resp.status_code}). If a "
            "code change just widened the fromDate/toDate range, check it's "
            f"still under {CHARTS_MAX_RANGE_DAYS} days -- CSE silently "
            "rejects wider ranges with this same error. Otherwise, the "
            "session token has likely expired: log into cse.lk again and "
            "update CSE_ACCESS_TOKEN in backend/.env."
        )
    try:
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        raise CSEUnavailableError(f"Unexpected CSE charts response: {exc}") from exc

    rows = data if isinstance(data, list) else data.get("data") or data.get("reqChartData")
    if not rows:
        raise CSEAuthError(
            "CSE charts endpoint returned no rows -- the session token is most "
            "likely expired. Refresh CSE_ACCESS_TOKEN in backend/.env."
        )

    return rows


def extract_close(row: dict) -> float | None:
    for key in ("close", "closingPrice", "closePrice", "price", "tradePrice", "value"):
        if key in row and row[key] is not None:
            try:
                return float(row[key])
            except (TypeError, ValueError):
                continue
    return None


def extract_date(row: dict) -> str | None:
    """Returns an ISO date string. `tradeDate` (confirmed real field) is epoch milliseconds."""
    if row.get("tradeDate") is not None:
        try:
            return datetime.utcfromtimestamp(row["tradeDate"] / 1000).strftime("%Y-%m-%d")
        except (TypeError, ValueError, OSError):
            pass
    for key in ("date", "x", "tradeDateStr"):
        if row.get(key) is not None:
            return str(row[key])
    return None


def compute_volatility_10d(symbol: str) -> float:
    """
    Annualized stdev of the last VOL_WINDOW daily returns, matching
    prepare_dataset_v6.py's volatility_{w}d feature:
      v = returns.tail(w).std() * sqrt(ANN_FACTOR)
    """
    to_date = datetime.utcnow()
    from_date = to_date - timedelta(days=CHARTS_MAX_RANGE_DAYS)
    rows = fetch_price_history(symbol, from_date, to_date, period=1)

    # CSE returns rows newest-first; sort ascending so returns are computed
    # forward in time (today vs. yesterday), not backward.
    rows = sorted(rows, key=lambda r: r.get("tradeDate") or 0)
    closes = [c for c in (extract_close(r) for r in rows) if c is not None]
    if len(closes) < VOL_WINDOW + 1:
        raise CSEUnavailableError(
            f"Only {len(closes)} priced days returned for '{symbol}' in the last 45 "
            f"days -- need at least {VOL_WINDOW + 1} to compute volatility_10d."
        )

    returns = [
        (closes[i] - closes[i - 1]) / closes[i - 1]
        for i in range(1, len(closes))
        if closes[i - 1] != 0
    ]
    window = returns[-VOL_WINDOW:]
    mean = sum(window) / len(window)
    variance = sum((r - mean) ** 2 for r in window) / (len(window) - 1)
    return (variance ** 0.5) * (ANN_FACTOR ** 0.5)
