"""
Generate the training-validation artifacts consumed by the Validation page:

  backend/app/data/model_metrics.json
  backend/app/data/plots/predicted_vs_actual.png
  backend/app/data/plots/pr_curve.png

Company data (list, current price, live volatility) is NOT generated here
anymore -- it's fetched live from the CSE API at request time (see
backend/app/cse_client.py). This script only covers the numbers that can't
come from a live market-data feed: your model's own validation metrics from
training.

------------------------------------------------------------------------
Right now this only generates PLACEHOLDER metrics (clearly labeled), because
the model is still training and no validated test-set metrics exist yet.

BEFORE THE VIVA, replace `build_model_metrics` below with your real saved
metrics (RMSE, R^2, Pearson, Spearman, PR-AUC, baseline PR-AUC) from the
training notebook, and copy the notebook's actual predicted-vs-actual and
PR-curve PNGs into backend/app/data/plots/ with the filenames below (or
update PLOT_FILENAMES). Then re-run with `--real` so it doesn't print the
placeholder warning.
------------------------------------------------------------------------
"""
import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

DATA_DIR = Path(__file__).resolve().parent.parent / "app" / "data"
PLOTS_DIR = DATA_DIR / "plots"

PLOT_FILENAMES = {
    "predicted_vs_actual": "predicted_vs_actual.png",
    "pr_curve": "pr_curve.png",
}


def build_model_metrics():
    return {
        "_placeholder": True,
        "note": (
            "PLACEHOLDER METRICS -- the model is still training. These are "
            "not real numbers. Regenerate this file from the training "
            "notebook's saved metrics before using it for the viva."
        ),
        "n_test_samples": None,
        "rmse": None,
        "r2": None,
        "pearson": None,
        "spearman": None,
        "pr_auc": None,
        "pr_auc_baseline": None,
        "significance_cutoff_pct": None,
        "plots": {
            "predicted_vs_actual": f"/static/plots/{PLOT_FILENAMES['predicted_vs_actual']}",
            "pr_curve": f"/static/plots/{PLOT_FILENAMES['pr_curve']}",
        },
    }


def make_placeholder_plot(path: Path, title: str):
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.text(
        0.5, 0.5, "PLACEHOLDER\n(replace with real\nnotebook output)",
        ha="center", va="center", fontsize=13, color="#888888",
    )
    ax.set_title(title)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_color("#cccccc")
    fig.savefig(path, dpi=110, bbox_inches="tight")
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--real", action="store_true",
        help="Acknowledge you have wired in real metrics below (skips the placeholder warning).",
    )
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)

    metrics = build_model_metrics()
    (DATA_DIR / "model_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    make_placeholder_plot(PLOTS_DIR / PLOT_FILENAMES["predicted_vs_actual"], "Predicted vs Actual CAR")
    make_placeholder_plot(PLOTS_DIR / PLOT_FILENAMES["pr_curve"], "Precision-Recall Curve")

    if not args.real:
        print(
            "\n[build_data_artifacts] Wrote PLACEHOLDER model_metrics.json.\n"
            "Not real numbers -- regenerate from the training notebook before the viva.\n"
        )
    else:
        print("\n[build_data_artifacts] Wrote model_metrics.json.\n")


if __name__ == "__main__":
    main()
