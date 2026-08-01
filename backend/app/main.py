import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

APP_DIR = Path(__file__).resolve().parent
load_dotenv(APP_DIR.parent / ".env")  # backend/.env -- must run before cse_client reads CSE_ACCESS_TOKEN

from app.inference import CARPredictor
from app.routers import companies, metrics, predict

logger = logging.getLogger("uvicorn.error")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    weights_path = APP_DIR / "model_weights.pt"
    config_path = APP_DIR / "model_config.json"
    if weights_path.exists() and config_path.exists():
        app.state.predictor = CARPredictor(export_dir=str(APP_DIR))
        logger.info("Model loaded from %s", APP_DIR)
    else:
        app.state.predictor = None
        logger.warning(
            "model_weights.pt / model_config.json not found in %s -- "
            "/predict will return 503 until they are added and the server "
            "is restarted.",
            APP_DIR,
        )
    yield


app = FastAPI(title="CSE News-Impact Predictor API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router)
app.include_router(companies.router)
app.include_router(metrics.router)

PLOTS_DIR = APP_DIR / "data" / "plots"
PLOTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/plots", StaticFiles(directory=str(PLOTS_DIR)), name="plots")


@app.get("/health", tags=["health"])
def health():
    return {
        "status": "ok",
        "model_loaded": app.state.predictor is not None,
        "cse_access_token_configured": bool(os.environ.get("CSE_ACCESS_TOKEN")),
    }
