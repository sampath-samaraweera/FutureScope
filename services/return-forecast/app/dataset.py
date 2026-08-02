import csv
from pathlib import Path
from threading import Lock
from typing import Optional

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "X_train_scaled.csv"

NON_FEATURE_COLUMNS = ("COMPANY ID", "Date")

FEATURE_COLUMNS: list = []
_company_rows: dict = {}
_loaded = False
_lock = Lock()


def _load() -> None:
    global _loaded
    if _loaded:
        return
    with _lock:
        if _loaded:
            return
        with open(DATA_PATH, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            feature_cols = [c for c in reader.fieldnames if c not in NON_FEATURE_COLUMNS]
            FEATURE_COLUMNS.extend(feature_cols)
            for row in reader:
                company_id = row["COMPANY ID"]
                values = [float(row[col]) for col in feature_cols]
                _company_rows.setdefault(company_id, []).append((row["Date"], values))
        for rows in _company_rows.values():
            rows.sort(key=lambda r: r[0])
        _loaded = True


def get_feature_columns() -> list:
    _load()
    return list(FEATURE_COLUMNS)


def list_companies() -> list:
    _load()
    return sorted(_company_rows.keys())


def list_valid_end_dates(company_id: str, seq_len: int) -> list:
    _load()
    rows = _company_rows.get(company_id)
    if rows is None:
        raise KeyError(company_id)
    return [date for date, _ in rows[seq_len - 1 :]]


def get_window(company_id: str, seq_len: int, end_date: Optional[str] = None):
    """Returns (window_start_date, window_end_date, sequence) for the seq_len rows
    ending at end_date (inclusive), or the most recent seq_len rows if end_date is None."""
    _load()
    rows = _company_rows.get(company_id)
    if rows is None:
        raise KeyError(company_id)

    if end_date is None:
        idx = len(rows) - 1
    else:
        idx = next((i for i, (date, _) in enumerate(rows) if date == end_date), None)
        if idx is None:
            raise ValueError(f"No data for company '{company_id}' on {end_date}")

    if idx + 1 < seq_len:
        raise ValueError(
            f"Not enough history before {rows[idx][0]} for company '{company_id}' "
            f"(need {seq_len} rows, only {idx + 1} available)"
        )

    window_rows = rows[idx + 1 - seq_len : idx + 1]
    sequence = [values for _, values in window_rows]
    return window_rows[0][0], window_rows[-1][0], sequence
