"""
Headline category auto-detection.

Ported directly from `Data Preprocessing/all/prepare_dataset_v6.py`
(classify_category_v2, F1) so that headlines typed into the frontend are
classified with the exact same rules used to label the training data.
Do not diverge from the training-side logic without re-running data prep.
"""
import re

CATEGORIES = ["company_event", "macro", "general"]

CATEGORY_LABELS = {
    "company_event": "Company event",
    "macro": "Macro / economy",
    "general": "General news",
}

RE_CAPITAL = re.compile(
    r"\b(ipos?|rights issues?|buybacks?|buy-backs?|debentures?|acquisitions?|"
    r"acquires?|mergers?|takeovers?|stakes?|share issues?|capital raise|"
    r"bond issues?|divests?|divestiture)\b", re.I)
RE_EARNINGS = re.compile(
    r"\b(profits?|profitability|pat|pbt|net income|revenues?|eps|dividends?|"
    r"earnings?|financial results?|interim results?|quarterly results?|"
    r"annual results?|q[1-4]|1h|2h|9m|first quarter|second quarter|"
    r"third quarter|fourth quarter|posts? rs|records? rs|reports? rs)\b", re.I)
RE_MACRO = re.compile(
    r"\b(interest rate|policy rate|inflation|deflation|gdp|imf|world bank|"
    r"central bank|cbsl|monetary|rupee|forex|reserves|tax|budget|treasury|"
    r"bond yield|exchange rate|debt restructur\w*|recession|economy|economic)\b", re.I)


def strip_source(headline: str) -> str:
    h = str(headline)
    return h.rsplit(" - ", 1)[0].strip() if " - " in h else h.strip()


def classify_category_v2(headline: str, is_company: bool) -> str:
    body = strip_source(headline)
    if is_company and (RE_CAPITAL.search(body) or RE_EARNINGS.search(body)):
        return "company_event"
    if RE_MACRO.search(body):
        return "macro"
    return "general"
