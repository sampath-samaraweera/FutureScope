import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["metrics"])

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@router.get("/model-metrics")
def model_metrics():
    path = DATA_DIR / "model_metrics.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="model_metrics.json not found")
    with open(path, encoding="utf-8") as f:
        return json.load(f)
