"""
Service configuration -- paths and the CSE ticker -> display-name mapping
for the 10-asset banking-sector universe this model was trained on.
"""
import os

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(APP_DIR, "data")
MODELS_DIR = os.path.join(DATA_DIR, "models")

CHECKPOINT_PATH = os.path.join(MODELS_DIR, "final_model.pt")
MANIFEST_PATH = os.path.join(MODELS_DIR, "manifest.json")
SCALER_PATH = os.path.join(MODELS_DIR, "scaler.joblib")

TEST_WEIGHTS_PATH = os.path.join(DATA_DIR, "test_weights.csv")
TEST_SUMMARY_PATH = os.path.join(DATA_DIR, "test_summary.json")

INITIAL_CAPITAL = 1_000_000.0

# Ticker -> human-readable name, from the raw CSVs' SHORT NAME column.
ASSET_DISPLAY_NAMES = {
    "ABL": "Amana Bank",
    "COMB": "Commercial Bank",
    "DFCC": "DFCC Bank PLC",
    "HNB": "HNB",
    "NDB": "National Development Bank",
    "NTB": "Nations Trust Bank",
    "PABC": "Pan Asia Bank",
    "SAMP": "Sampath Bank",
    "SEYB": "Seylan Bank",
    "UBC": "Union Bank",
}
