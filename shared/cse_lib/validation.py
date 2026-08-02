"""
Input-quality checks for /predict. These either reject clearly-invalid input
(gibberish) or attach a non-blocking warning to the response (category/ticker
mismatches) -- they never change what the model actually predicts. Silently
"correcting" a model's output to look better would make the number meaningless
as a research result; surfacing a warning keeps the real prediction intact
while telling the caller their input might not mean what they think it does.
"""
import re

MIN_HEADLINE_LENGTH = 8
MIN_LETTERS = 6
MIN_WORD_COUNT = 2
# 4+ of the same letter in a row essentially never happens in real English
# (genuine words top out around 2, rarely 3, identical letters in a row --
# "committee", "necessary"). A naive whole-string "letter diversity ratio"
# was tried first and rejected: it naturally drops for any longer text
# (common letters like e/a/t/n/s recur throughout normal English), so it
# flagged legitimate long headlines as gibberish. A repeated-run check is
# length-invariant and targets the actual failure mode instead.
REPEATED_RUN_RE = re.compile(r"([a-zA-Z])\1{3,}")


def is_gibberish(headline: str) -> bool:
    """
    Lightweight, dependency-free heuristic -- NOT real language detection.
    Catches low-effort junk (repeated characters, single "words", too-short
    strings) like "aaaaaaaa" or "asdf". Will not catch a deliberately
    realistic-looking keyboard mash; that's an accepted, disclosed
    limitation, not a claim of perfect validation.
    """
    text = headline.strip()
    if len(text) < MIN_HEADLINE_LENGTH:
        return True

    letters = [c for c in text if c.isalpha()]
    if len(letters) < MIN_LETTERS:
        return True

    words = [w for w in re.split(r"\s+", text) if w]
    if len(words) < MIN_WORD_COUNT:
        return True

    if REPEATED_RUN_RE.search(text):
        return True

    return False


# Generic words that appear in most Sri Lankan company names and carry no
# distinguishing power for matching a specific company against headline text.
CORP_STOPWORDS = {
    "PLC", "LIMITED", "LTD", "COMPANY", "CO", "HOLDINGS", "GROUP", "CORP",
    "CORPORATION", "OF", "AND", "THE", "BANK", "BANKING", "CEYLON",
    "NATIONAL", "SRI", "LANKA", "SL",
}


def _significant_tokens(company_name: str) -> list[str]:
    tokens = re.findall(r"[A-Za-z']+", company_name.upper())
    return [t for t in tokens if t not in CORP_STOPWORDS and len(t) >= 3]


def ticker_mentioned_in_headline(headline: str, ticker: str, company_name: str) -> bool:
    """
    Fuzzy check: does the headline plausibly refer to this company? Matches
    on the ticker's base symbol (e.g. "COMB" from "COMB.N0000") or any
    distinctive word from the company name (corporate boilerplate like
    "PLC"/"BANK"/"HOLDINGS" stripped out first, since those match almost
    every company and would never flag a real mismatch).
    """
    headline_upper = headline.upper()
    ticker_base = ticker.split(".")[0]
    if re.search(rf"\b{re.escape(ticker_base)}\b", headline_upper):
        return True

    tokens = _significant_tokens(company_name)
    if not tokens:
        return True  # nothing distinctive to check against -- don't false-flag

    return any(re.search(rf"\b{re.escape(tok)}\b", headline_upper) for tok in tokens)
