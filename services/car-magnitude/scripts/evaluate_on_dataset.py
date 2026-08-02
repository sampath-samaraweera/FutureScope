"""
Samples rows from the model's own held-out TEST split (dataset_final_v6.csv,
per model_config.json's DATA_PATH) and compares the deployed model's
predicted CAR magnitude against the real, historical actual CAR magnitude.

Deliberately does NOT go through the live CSE API or the FastAPI /predict
endpoint: this dataset has no per-row ticker column (dropped upstream in
prepare_dataset_v6.py), and even if it did, feeding today's live volatility
into a historical headline would be wrong -- what the model was actually
trained on is that row's own historical volatility_10d, which the CSV
already has. This calls CARPredictor.predict() directly with the row's own
feature values, which is the only methodologically correct way to reproduce
what the model saw during evaluation.

Run from backend/, with the venv active:
    python scripts/evaluate_on_dataset.py [n_samples]
"""
import csv
import random
import sys
from pathlib import Path

import numpy as np

APP_DIR = Path(__file__).resolve().parent.parent / "app"
sys.path.insert(0, str(APP_DIR.parent))

from app.inference import CARPredictor  # noqa: E402

DATASET_PATH = Path(__file__).resolve().parents[4] / "Data Preprocessing" / "all" / "dataset_final_v6.csv"
MAX_GAP_DAYS = 5  # must match model_config.json's max_gap_days
SEED = 42


def load_test_rows():
    with open(DATASET_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return [r for r in rows if r["split"] == "test"]


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows console defaults to cp1252
    n_samples = int(sys.argv[1]) if len(sys.argv) > 1 else 20

    test_rows = load_test_rows()
    print(f"Test split: {len(test_rows)} rows. Sampling {n_samples} (seed={SEED}).\n")

    random.seed(SEED)
    sample = random.sample(test_rows, min(n_samples, len(test_rows)))

    predictor = CARPredictor(export_dir=str(APP_DIR), load_sentiment=False)

    results = []
    for row in sample:
        n_articles = max(1, round(float(np.expm1(float(row["n_articles_log"])))))
        days_since_publication = float(row["time_since_open"]) * MAX_GAP_DAYS

        out = predictor.predict(
            headline=row["text_input"],
            category=row["category"],
            is_company_specific=float(row["is_company_specific"]),
            is_local_source=float(row["is_local_source"]),
            volatility_10d=float(row["volatility_10d"]),
            days_since_publication=days_since_publication,
            n_articles=n_articles,
            include_sentiment=False,
        )
        actual_pct = abs(float(row["car_pct"])) * 100
        predicted_pct = out["predicted_car_magnitude_pct"]
        results.append({
            "headline": row["text_input"][:70],
            "category": row["category"],
            "actual_pct": actual_pct,
            "predicted_pct": predicted_pct,
            "abs_error": abs(predicted_pct - actual_pct),
            "actual_significant": actual_pct >= out["significance_cutoff_pct"],
            "predicted_significant": out["is_likely_significant"],
        })

    results.sort(key=lambda r: r["abs_error"])

    print(f"{'Headline':<72} {'Cat':<14} {'Actual%':>8} {'Pred%':>7} {'Err':>6} {'SigMatch':>9}")
    print("-" * 122)
    for r in results:
        sig_match = "yes" if r["actual_significant"] == r["predicted_significant"] else "NO"
        print(f"{r['headline']:<72} {r['category']:<14} {r['actual_pct']:>8.3f} "
              f"{r['predicted_pct']:>7.3f} {r['abs_error']:>6.3f} {sig_match:>9}")

    errors = [r["abs_error"] for r in results]
    mae = sum(errors) / len(errors)
    rmse = (sum(e ** 2 for e in errors) / len(errors)) ** 0.5
    sig_matches = sum(1 for r in results if r["actual_significant"] == r["predicted_significant"])
    actuals = [r["actual_pct"] for r in results]
    preds = [r["predicted_pct"] for r in results]
    corr = float(np.corrcoef(actuals, preds)[0, 1]) if len(set(actuals)) > 1 and len(set(preds)) > 1 else float("nan")

    print()
    print(f"MAE:  {mae:.3f} pct points")
    print(f"RMSE: {rmse:.3f} pct points")
    print(f"Pearson correlation (predicted vs actual magnitude): {corr:.3f}")
    print(f"Significance flag matched actual: {sig_matches}/{len(results)}")


if __name__ == "__main__":
    main()
