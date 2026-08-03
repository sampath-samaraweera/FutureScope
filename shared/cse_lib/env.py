"""
Loads the single repo-root .env shared by every service (return-forecast,
car-magnitude, portfolio-allocation, ...), so CSE_ACCESS_TOKEN and any other
shared secret only needs to be set in one place instead of duplicated per
service.
"""
from pathlib import Path

from dotenv import load_dotenv

# shared/cse_lib/env.py -> shared/cse_lib -> shared -> repo root
_REPO_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


def load_shared_env() -> None:
    """Loads the repo-root .env into the process environment. Safe to call
    more than once (e.g. if a service also has its own local .env for
    overrides) -- load_dotenv() never overwrites a variable already set."""
    load_dotenv(_REPO_ROOT_ENV)
