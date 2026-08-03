"""
Serves the already-exported test-set backtest: app/data/test_weights.csv
(per-day weights, produced by the training run's own backtest) and
app/data/test_summary.json (summary metrics).

The original research script reconstructed real calendar dates for each row
by re-running the full data-loading + feature-engineering pipeline against
the raw yearly CSE banking-sector CSVs (data/raw/*_banking_sector.csv).
Those raw files aren't part of this export, so real dates can't be
reconstructed here -- rows are labeled by sequential trading-day index
("Day 1", "Day 2", ...) instead of fabricating calendar dates.
"""
import functools
import json
import os

import pandas as pd

from . import config


@functools.lru_cache(maxsize=1)
def get_backtest_dataset() -> dict:
    if not os.path.exists(config.TEST_WEIGHTS_PATH):
        raise FileNotFoundError(f"{config.TEST_WEIGHTS_PATH} not found.")
    if not os.path.exists(config.TEST_SUMMARY_PATH):
        raise FileNotFoundError(f"{config.TEST_SUMMARY_PATH} not found.")

    weights_df = pd.read_csv(config.TEST_WEIGHTS_PATH)
    asset_names = [
        col[: -len("_weight")]
        for col in weights_df.columns
        if col.endswith("_weight") and not col.endswith("_raw_weight")
    ]

    records = []
    for i, row in weights_df.iterrows():
        portfolio_value = float(row["portfolio_value"])
        allocations = []
        for asset in asset_names:
            col = f"{asset}_weight"
            weight = float(row[col])
            allocations.append(
                {
                    "asset": asset,
                    "name": config.ASSET_DISPLAY_NAMES.get(asset, asset),
                    "weight": weight,
                    "value_lkr": weight * portfolio_value,
                }
            )
        allocations.sort(key=lambda a: a["weight"], reverse=True)

        records.append(
            {
                "index": int(i),
                "label": f"Day {int(i) + 1}",
                "portfolio_value": portfolio_value,
                "portfolio_return": float(row["portfolio_return"]),
                "total_cost": float(row["total_cost"]),
                "allocations": allocations,
            }
        )

    with open(config.TEST_SUMMARY_PATH, "r", encoding="utf-8") as f:
        summary = json.load(f)

    return {
        "asset_names": asset_names,
        "dates_available": False,
        "days": records,
        "summary": summary,
    }
