"""
Runs the deployed model against its full TEST split (dataset_final_v6.csv,
per model_config.json) and writes real model_metrics.json + the two plots
consumed by the Validation page.

Scalar metrics (RMSE, R2, Pearson, Spearman, PR-AUC, baselines) come
straight from model_config.json's final_metrics -- the authoritative numbers
from the actual training/validation run (inference.py's magnitude_note:
"confirmed across 11 independent training runs"). This script's own
full-test-set re-evaluation is included as a cross-check (see
"reevaluation_check" in the output) and is what the two plots are generated
from, since the original notebook's saved PNGs aren't available in this
environment -- these are freshly computed from real model output on real
held-out data, not fabricated, just not literally the same file the
notebook produced.

Run from backend/, with the venv active:
    python scripts/generate_real_metrics.py
"""
import csv
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

APP_DIR = Path(__file__).resolve().parent.parent / "app"
DATA_DIR = APP_DIR / "data"
PLOTS_DIR = DATA_DIR / "plots"
sys.path.insert(0, str(APP_DIR.parent))

from app.inference import CARPredictor  # noqa: E402

DATASET_PATH = Path(__file__).resolve().parents[4] / "Data Preprocessing" / "all" / "dataset_final_v6.csv"
MAX_GAP_DAYS = 5


def load_test_rows():
    with open(DATASET_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return [r for r in rows if r["split"] == "test"]


def spearman(x, y):
    def rank(a):
        order = np.argsort(a)
        ranks = np.empty_like(order, dtype=float)
        ranks[order] = np.arange(len(a))
        return ranks
    rx, ry = rank(np.array(x)), rank(np.array(y))
    return float(np.corrcoef(rx, ry)[0, 1])


def precision_recall_curve(y_true, scores):
    order = np.argsort(-np.array(scores))
    y_true_sorted = np.array(y_true)[order]
    tp = np.cumsum(y_true_sorted)
    fp = np.cumsum(1 - y_true_sorted)
    precision = tp / (tp + fp)
    recall = tp / y_true_sorted.sum()
    precision = np.concatenate([[1.0], precision])
    recall = np.concatenate([[0.0], recall])
    return precision, recall


def pr_auc_trapezoid(precision, recall):
    order = np.argsort(recall)
    r, p = recall[order], precision[order]
    return float(np.sum((r[1:] - r[:-1]) * (p[1:] + p[:-1]) / 2))


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    with open(APP_DIR / "model_config.json") as f:
        config = json.load(f)
    cutoff_pct = config["significance_cutoff"] * 100

    test_rows = load_test_rows()
    print(f"Evaluating on full test split: {len(test_rows)} rows...")

    predictor = CARPredictor(export_dir=str(APP_DIR), load_sentiment=False)

    actual_pct, predicted_pct = [], []
    for i, row in enumerate(test_rows):
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
        actual_pct.append(abs(float(row["car_pct"])) * 100)
        predicted_pct.append(out["predicted_car_magnitude_pct"])
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(test_rows)}")

    actual_pct = np.array(actual_pct)
    predicted_pct = np.array(predicted_pct)
    actual_sig = (actual_pct >= cutoff_pct).astype(int)

    mae = float(np.mean(np.abs(predicted_pct - actual_pct)))
    rmse = float(np.sqrt(np.mean((predicted_pct - actual_pct) ** 2)))
    pearson_reeval = float(np.corrcoef(actual_pct, predicted_pct)[0, 1])
    spearman_reeval = spearman(actual_pct, predicted_pct)
    precision, recall = precision_recall_curve(actual_sig, predicted_pct)
    pr_auc_reeval = pr_auc_trapezoid(precision, recall)

    fm = config["final_metrics"]
    print(f"\nAuthoritative (model_config.json): RMSE={fm['RMSE']:.4f} R2={fm['R2']:.4f} "
          f"Pearson={fm['Pearson']:.4f} Spearman={fm['Spearman']:.4f} PR-AUC={fm['PR_AUC']:.4f}")
    print(f"This re-evaluation ({len(test_rows)} rows): RMSE={rmse:.4f} "
          f"Pearson={pearson_reeval:.4f} Spearman={spearman_reeval:.4f} PR-AUC={pr_auc_reeval:.4f}")

    PLOTS_DIR.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(5.5, 5))
    ax.scatter(actual_pct, predicted_pct, s=14, alpha=0.4, color="#2563eb", edgecolors="none")
    lims = [0, max(float(actual_pct.max()), float(predicted_pct.max())) * 1.05]
    ax.plot(lims, lims, "--", color="#999999", linewidth=1, label="Perfect prediction")
    ax.set_xlabel("Actual |CAR| (%)")
    ax.set_ylabel("Predicted |CAR| (%)")
    ax.set_title(f"Predicted vs Actual -- full test set (n={len(test_rows)})")
    ax.legend(fontsize=8)
    fig.savefig(PLOTS_DIR / "predicted_vs_actual.png", dpi=130, bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(5.5, 5))
    order = np.argsort(recall)
    ax.plot(recall[order], precision[order], color="#2563eb", linewidth=1.5,
            label=f"Model (AUC={pr_auc_reeval:.3f})")
    baseline_p = float(actual_sig.mean())
    ax.axhline(baseline_p, color="#999999", linestyle="--", linewidth=1,
               label=f"Random baseline ({baseline_p:.3f})")
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_ylim(0, 1.05)
    ax.set_title("Precision-Recall -- flagging significant events")
    ax.legend(fontsize=8)
    fig.savefig(PLOTS_DIR / "pr_curve.png", dpi=130, bbox_inches="tight")
    plt.close(fig)

    metrics = {
        "_placeholder": False,
        "note": (
            "Scalar metrics below are the authoritative numbers from the "
            "training/validation notebook (model_config.json's final_metrics, "
            f"deployed seed {config['deployed_seed']}, confirmed across 11 "
            "independent training runs per inference.py). Plots were freshly "
            "generated by re-running the deployed model over the full test "
            "split (backend/scripts/generate_real_metrics.py) since the "
            "notebook's original saved figures weren't available in this "
            "environment -- real model output on real held-out data, "
            "regenerated rather than fabricated."
        ),
        "n_test_samples": len(test_rows),
        "rmse": fm["RMSE"],
        "mae": fm["MAE"],
        "r2": fm["R2"],
        "pearson": fm["Pearson"],
        "spearman": fm["Spearman"],
        "pr_auc": fm["PR_AUC"],
        "pr_auc_baseline": fm["random_baseline_precision"],
        "baseline_rmse": fm["baseline_RMSE"],
        "significance_cutoff_pct": round(cutoff_pct, 3),
        "reevaluation_check": {
            "note": "This script's own re-run over the same test split, as a cross-check against the numbers above.",
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "pearson": round(pearson_reeval, 4),
            "spearman": round(spearman_reeval, 4),
            "pr_auc": round(pr_auc_reeval, 4),
        },
        "plots": {
            "predicted_vs_actual": "/static/plots/predicted_vs_actual.png",
            "pr_curve": "/static/plots/pr_curve.png",
        },
    }
    (DATA_DIR / "model_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"\nWrote {DATA_DIR / 'model_metrics.json'}")
    print(f"Wrote plots to {PLOTS_DIR}")


if __name__ == "__main__":
    main()
