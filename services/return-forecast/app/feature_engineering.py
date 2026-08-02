"""Reproduces the per-company technical-indicator feature engineering from
preprocess.ipynb (cells 42-56), so raw OHLCV+macro history can be converted
into the same 45 engineered features the model was trained on.

Scaling note: the notebook fits one sklearn StandardScaler PER COMPANY on
that company's own historical feature rows (see preprocess.ipynb cell 66).
Those fitted scalers were never saved to disk -- only their output
(X_train_scaled.csv). So here we refit a StandardScaler on whatever raw
history is supplied for a company and use that. This reproduces the
methodology, but the exact scaler parameters will differ from the original
training run unless the supplied history closely matches the original
training window (2020-03 through 2023-12) in length and distribution.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

RAW_COLUMNS = [
    "PRICE HIGH (Rs.)",
    "PRICE LOW (Rs.)",
    "CLOSE PRICE (Rs.)",
    "OPEN PRICE (Rs.)",
    "TRADE VOLUME (No.)",
    "SHARE VOLUME (No.)",
    "TURNOVER (Rs.)",
    "Sector_Index",
    "Exchange Rate",
    "YoY_Inflation_%",
]

# The exact 45 feature columns and order the model was trained on -- confirmed
# directly from preprocess.ipynb's cell 61 DataFrame.info() output (10 raw
# columns kept as-is, then 35 engineered ones in the order cells 42-56 add
# them). Hardcoded so the live prediction path (predict-from-raw-history)
# has zero dependency on data/X_train_scaled.csv -- that file is only needed
# for the historical-replay endpoints (predict-from-dataset, /companies).
FEATURE_COLUMNS = RAW_COLUMNS + [
    "Daily_Return", "Log_Return", "High_Low_Range", "Open_Close_Change",
    "SMA_5", "EMA_5", "SMA_10", "EMA_10", "SMA_20", "EMA_20",
    "Price_vs_EMA20_Ratio", "Vol_5Day", "Vol_20Day", "RSI_14",
    "MACD", "MACD_Signal", "BB_StdDev", "BB_Upper", "BB_Lower", "BB_Percent_B",
    "ROC_10Day", "Stochastic_K", "Stochastic_D", "Volume_Change",
    "SMA_5_Turnover", "Turnover_vs_SMA5", "Sector_Index_Return",
    "USD_LKR_Return", "Relative_Strength", "Rolling_20Day_Beta",
    "Day_of_Week_Sin", "Day_of_Week_Cos", "Month_Sin", "Month_Cos",
    "Is_Quarter_End_Month",
]

# Minimum raw rows needed before the slowest-warming indicator (20-day
# rolling beta / volatility, computed on a return series that itself loses
# its first row) produces its first non-NaN value.
MIN_WARMUP_ROWS = 21


def _rsi(close: pd.Series, window: int = 14) -> pd.Series:
    """Matches preprocess.ipynb's calculate_rsi (cell 46) exactly, including
    its lack of a flat-price (0/0) guard -- that produces NaN/inf here too,
    same as the original training pipeline, rather than a "nicer" 50/100."""
    delta = close.diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    avg_gain = gain.ewm(com=window - 1, adjust=False).mean()
    avg_loss = loss.ewm(com=window - 1, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _stochastic(df: pd.DataFrame, k_window: int = 14, d_window: int = 3):
    lowest_low = df["PRICE LOW (Rs.)"].rolling(window=k_window).min()
    highest_high = df["PRICE HIGH (Rs.)"].rolling(window=k_window).max()
    range_hl = highest_high - lowest_low

    k_percent = pd.Series(
        np.where(
            (range_hl == 0) | range_hl.isna(),
            0.0,
            ((df["CLOSE PRICE (Rs.)"] - lowest_low) / range_hl) * 100,
        ),
        index=df.index,
    )
    d_percent = k_percent.rolling(window=d_window).mean()
    return k_percent, d_percent


def _pad_raw_history(raw_df: pd.DataFrame, min_rows: int):
    """If raw_df has fewer than min_rows, prepend synthetic rows (before the
    earliest real date) so the rolling-window indicators can compute at all.
    Synthetic rows clone the earliest real row's values with a small
    deterministic oscillation (not real randomness, so results are
    reproducible) -- just enough to avoid exact-zero variance, which would
    otherwise make RSI/beta/volatility permanently undefined.

    This does NOT make the result a real forecast: the further short of
    min_rows the real input is, the more of the computed window is built on
    fabricated history rather than actual market data. Returns
    (padded_df, num_synthetic_rows_added)."""
    df = raw_df.sort_values("Date").reset_index(drop=True).copy()
    df["Date"] = pd.to_datetime(df["Date"])

    n_missing = min_rows - len(df)
    if n_missing <= 0:
        return df, 0

    anchor = df.iloc[0]
    anchor_date = anchor["Date"]

    pad_rows = []
    for i in range(n_missing, 0, -1):
        wobble = 1 + 0.0006 * (((n_missing - i) % 7) - 3)
        row = {"Date": anchor_date - pd.tseries.offsets.BDay(i)}
        for col in RAW_COLUMNS:
            row[col] = float(anchor[col]) * wobble
        pad_rows.append(row)

    padded = pd.concat([pd.DataFrame(pad_rows), df], ignore_index=True)
    padded = padded.sort_values("Date").reset_index(drop=True)
    return padded, n_missing


def engineer_features(raw_df: pd.DataFrame) -> pd.DataFrame:
    """raw_df must have a 'Date' column plus all of RAW_COLUMNS, for a single
    company, in any row order. Returns a DataFrame sorted by Date with the 45
    engineered feature columns added (still unscaled); rows where any
    indicator hasn't warmed up yet still contain NaN, matching the notebook's
    pre-dropna state."""
    missing = [c for c in RAW_COLUMNS if c not in raw_df.columns]
    if missing:
        raise ValueError(f"Missing required raw columns: {missing}")

    df = raw_df.sort_values("Date").reset_index(drop=True).copy()
    df["Date"] = pd.to_datetime(df["Date"])

    close = df["CLOSE PRICE (Rs.)"]
    high = df["PRICE HIGH (Rs.)"]
    low = df["PRICE LOW (Rs.)"]
    open_ = df["OPEN PRICE (Rs.)"]

    df["Daily_Return"] = close.pct_change()
    df["Log_Return"] = np.log(close.ffill() / close.ffill().shift(1))
    df["High_Low_Range"] = (high - low) / close
    df["Open_Close_Change"] = (close - open_) / open_

    for period in (5, 10, 20):
        df[f"SMA_{period}"] = close.rolling(window=period).mean()
        df[f"EMA_{period}"] = close.ewm(span=period, adjust=False).mean()

    df["Price_vs_EMA20_Ratio"] = close / df["EMA_20"]

    df["Vol_5Day"] = df["Daily_Return"].rolling(window=5).std()
    df["Vol_20Day"] = df["Daily_Return"].rolling(window=20).std()

    df["RSI_14"] = _rsi(close, 14)

    ema_fast = close.ewm(span=12, adjust=False).mean()
    ema_slow = close.ewm(span=26, adjust=False).mean()
    df["MACD"] = ema_fast - ema_slow
    df["MACD_Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()

    bb_middle = close.rolling(window=20).mean()
    bb_std = close.rolling(window=20).std()
    df["BB_StdDev"] = bb_std
    df["BB_Upper"] = bb_middle + bb_std * 2
    df["BB_Lower"] = bb_middle - bb_std * 2
    df["BB_Percent_B"] = (close - df["BB_Lower"]) / (df["BB_Upper"] - df["BB_Lower"])

    df["ROC_10Day"] = ((close / close.shift(10)) - 1) * 100

    k_percent, d_percent = _stochastic(df, 14, 3)
    df["Stochastic_K"] = k_percent
    df["Stochastic_D"] = d_percent

    df["Volume_Change"] = df["TRADE VOLUME (No.)"].pct_change()
    sma5_turnover = df["TURNOVER (Rs.)"].rolling(window=5).mean()
    df["SMA_5_Turnover"] = sma5_turnover
    df["Turnover_vs_SMA5"] = df["TURNOVER (Rs.)"] / sma5_turnover

    df["Sector_Index_Return"] = df["Sector_Index"].pct_change()
    df["USD_LKR_Return"] = df["Exchange Rate"].pct_change()
    df["Relative_Strength"] = df["Daily_Return"] - df["Sector_Index_Return"]

    cov = df["Daily_Return"].rolling(window=20).cov(df["Sector_Index_Return"])
    var = df["Sector_Index_Return"].rolling(window=20).var()
    df["Rolling_20Day_Beta"] = (cov / var).replace([np.inf, -np.inf], np.nan)

    dow = df["Date"].dt.dayofweek
    df["Day_of_Week_Sin"] = np.sin(2 * np.pi * dow / 7)
    df["Day_of_Week_Cos"] = np.cos(2 * np.pi * dow / 7)
    month = df["Date"].dt.month
    df["Month_Sin"] = np.sin(2 * np.pi * month / 12)
    df["Month_Cos"] = np.cos(2 * np.pi * month / 12)
    df["Is_Quarter_End_Month"] = month.isin([3, 6, 9, 12]).astype(int)

    return df


def build_scaled_window(raw_df: pd.DataFrame, feature_columns: list, seq_len: int, allow_padding: bool = True):
    """Runs the full raw -> (optionally padded) -> engineered -> dropna ->
    per-company-scaled pipeline and returns (sequence, window_start_date,
    window_end_date, num_valid_rows_used_for_scaling, num_synthetic_rows_in_window).
    Raises ValueError if there isn't enough history (real + synthetic) to
    produce a usable window."""
    min_required = MIN_WARMUP_ROWS + seq_len

    real_row_count = len(raw_df)
    if allow_padding:
        working_df, num_padded = _pad_raw_history(raw_df, min_required)
    else:
        working_df, num_padded = raw_df, 0

    engineered = engineer_features(working_df)

    valid = engineered.dropna(subset=feature_columns).reset_index(drop=True)
    if len(valid) < seq_len:
        raise ValueError(
            f"After computing indicators, only {len(valid)} fully warmed-up rows are "
            f"available (need {seq_len}). Provide at least {min_required} raw rows of "
            "history (padding alone couldn't make up the gap)."
        )

    scaler = StandardScaler()
    scaled_matrix = scaler.fit_transform(valid[feature_columns].to_numpy())

    window = scaled_matrix[-seq_len:]
    window_dates = valid["Date"].iloc[-seq_len:]

    real_start_date = working_df["Date"].iloc[num_padded] if num_padded > 0 else working_df["Date"].iloc[0]
    synthetic_rows_in_window = int((window_dates < real_start_date).sum())

    # The target the model was trained on is defined as
    # (future_close / close_at_window_end_date) - 1, so that's the base price
    # to turn the predicted returns back into Rs. values.
    last_close_price = float(valid["CLOSE PRICE (Rs.)"].iloc[-1])

    return (
        window.tolist(),
        window_dates.iloc[0].strftime("%Y-%m-%d"),
        window_dates.iloc[-1].strftime("%Y-%m-%d"),
        len(valid),
        synthetic_rows_in_window,
        real_row_count,
        last_close_price,
    )
