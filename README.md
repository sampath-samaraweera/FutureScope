# CSE News-Impact Predictor

Predicts the **magnitude** of a Colombo Stock Exchange market reaction to a
news headline (not its direction — direction was tested during training and
found unlearnable from headline text alone). FastAPI backend wrapping the
trained FinBERT + MLP model, React/Vite/TypeScript frontend. Company list,
prices, and the volatility fed into predictions all come live from the CSE
API — there is no fake/demo market data anywhere in this app. Scoped to the
banking sector (the project's focus) — see [Scope: banks only](#scope-banks-only).

## Status

Backend, frontend, live CSE data, and the trained model are all wired
end-to-end and working, including live volatility for company-specific
predictions (see [Live CSE data](#live-cse-data) for the auth setup this
needs, and its one real gotcha).

## Project structure

```
Model/
├── inference.py               # original, unmodified copy (source of truth)
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, startup model load, .env loading, /health
│   │   ├── inference.py       # copied from ../inference.py verbatim
│   │   ├── category.py        # classify_category_v2, ported from prepare_dataset_v6.py
│   │   ├── cse_client.py      # live CSE API client (trade summary, company info, price history, volatility)
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── predict.py     # POST /predict
│   │   │   ├── companies.py   # GET /companies, GET /companies/{ticker}
│   │   │   └── metrics.py     # GET /model-metrics
│   │   ├── model_weights.pt   # your trained model
│   │   ├── model_config.json  # your trained model's config
│   │   └── data/
│   │       ├── model_metrics.json   # training-validation metrics (not from CSE -- see below)
│   │       └── plots/*.png
│   ├── scripts/
│   │   └── build_data_artifacts.py   # (re)generates model_metrics.json + plots
│   ├── .env                   # CSE_ACCESS_TOKEN goes here (gitignored)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/{Home,Validation,CompanySnapshot}.tsx
    │   ├── components/{HeadlineForm,CompanySelector,ResultsCard,SentimentBadge,PRCurveChart}.tsx
    │   ├── lib/categoryPreview.ts        # client-side preview only; backend is authoritative
    │   └── api/{client.ts,types.ts}
    └── package.json
```

## Running it

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` for the interactive API docs.

`requirements.txt` uses minimum-version ranges rather than exact pins for
torch/transformers/pydantic, because exact old pins may have no prebuilt
wheel for whatever Python you're on (this was built/tested against Python
3.14 — pydantic-core's Rust build currently fails there for old pydantic
versions, and old numpy has no 3.14 wheel either, which is why the ranges
are left open). If you're on Python 3.10-3.12 you can pin exact versions.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173`. It talks to the backend at
`http://localhost:8000` by default — override with `VITE_API_BASE_URL` (see
`frontend/.env.example`).

## Live CSE data

Three `www.cse.lk` endpoints are used, reverse-engineered from the site's own
network calls (`backend/app/cse_client.py`):

| Endpoint | Auth needed? | Used for |
|---|---|---|
| `POST /api/tradeSummary` | No | Full company list + today's price/change (`GET /companies`) |
| `POST /api/companyInfoSummery` | No | Per-company detail: price, previous close (`GET /companies/{ticker}`) |
| `POST /api/charts` | **Yes** | Daily price history → the `volatility_10d` feature the model actually uses |

Only `/api/charts` needs auth, and there's no way to get a valid token
without actually logging into cse.lk yourself — see
[Why we didn't automate login](#why-we-didnt-automate-login) if you're
wondering why this app doesn't have a login button.

**To enable it:**

1. Log into `https://www.cse.lk` in a normal browser, with your CSE account.
2. Open DevTools → Application (Chrome) or Storage (Firefox) → Cookies →
   `https://www.cse.lk` → copy the value of the `accessToken` cookie.
3. Copy `backend/.env.example` to `backend/.env` and paste it in:
   ```
   CSE_ACCESS_TOKEN=<paste here>
   ```
4. Restart the backend (`--reload` watches `.py` files, not `.env`, so a
   plain edit won't pick it up — stop and re-run `uvicorn`).

This token **will expire** (session tokens like this are typically valid for
hours, not days). When it does, `/companies/{ticker}` and company-specific
`/predict` calls will start returning a clear
`"CSE rejected this request"` error instead of silently breaking or falling
back to a fake number — repeat the steps above to refresh it. Check
`GET /health` any time to see whether a token is currently configured
(`cse_access_token_configured`).

**`/api/charts` rejects date ranges wider than ~31 calendar days**
(`CHARTS_MAX_RANGE_DAYS` in `cse_client.py`, currently 30 to stay safely
under that). This took a long detour to find: every manual test during
development used a hardcoded ~31-day example range and worked, while the
actual code computed a 45-day range and consistently failed with a
401/417 that looked like a bad or rate-limited token. Several wrong
theories got seriously chased first (a curl-vs-Python TLS fingerprint
difference, header-name casing, a request cooldown) because each looked
plausible under some test — a direct A/B test that changed *only* the
date range, holding everything else constant, settled it: 31 days = 200,
45 days = 401. If `/companies/{ticker}` or a company-specific `/predict`
call ever starts failing again after a code change, check whether the
range crept back up before suspecting the token.

Market-wide (not company-specific) predictions don't need this at all — they
use a documented static volatility assumption (`MARKET_WIDE_DEFAULT_VOLATILITY_10D`
in `predict.py`) since there's no public CSE index-volatility endpoint wired
in; the API response marks this explicitly via `"volatility_source":
"market_default"` vs `"live"`, and the frontend labels it the same way.

### Why we didn't automate login

cse.lk's "Sign in with Google" button redirects through **cse.lk's own**
OAuth registration; the session token it issues afterward has no
relationship to any OAuth flow *we* could run in our own app — Google
confirming your identity to us doesn't get cse.lk to hand out a session,
because cse.lk's server never participates in that exchange. The only way to
get a real token programmatically is to script an actual browser through
cse.lk's real login page and Google's real login form, which means storing
your Google password in the app and automating past Google's anti-bot
protections — a real credential-security risk not worth taking for a
university project. Manual copy-paste, refreshed occasionally, is the
practical tradeoff.

## `model_metrics.json` is not live data

Unlike company data, `backend/app/data/model_metrics.json` (RMSE, R²,
PR-AUC, etc. on the Validation page) **can't** come from a live market feed —
CSE has no idea what your model predicted historically. It's currently a
placeholder (`"_placeholder": true`, all values `null`), regenerated by
`backend/scripts/build_data_artifacts.py`. Before the viva, edit
`build_model_metrics()` in that script with your real training-notebook
metrics, copy the real predicted-vs-actual/PR-curve PNGs into
`backend/app/data/plots/`, and re-run with `--real`.

## Scope: banks only

`GET /companies` and `GET /companies/{ticker}` only return companies whose
CSE-listed name contains "Bank" (`cse_client.is_bank_name`) — driven off the
live company list, not a hardcoded ticker list, so it stays correct as CSE's
listings change. `/predict` independently enforces the same restriction on
`company_ticker` (400 if it's not a bank), so the scope holds even if a
request bypasses the frontend dropdown.

## Input validation & warnings (`backend/app/validation.py`)

Three real product gaps got found through manual testing (typing gibberish
still produced a plausible-looking prediction; picking the wrong category or
an unrelated company for a headline was silently accepted) — the fix is
**validation and warnings, never changing what the model actually outputs**.
A prediction number that's been quietly patched to "look right" stops being
a real research result; a warning next to an unchanged, honest number is not
the same thing.

- **Gibberish headlines are rejected (400)**, not scored. `is_gibberish()` is
  a lightweight, dependency-free heuristic (too short, too few words,
  4+ repeated characters in a row) — not real language detection. It won't
  catch a deliberately realistic-looking keyboard mash; that's an accepted,
  disclosed limitation. (An earlier version rejected legitimate long
  headlines too — it used a whole-string "letter diversity ratio," which
  naturally drops for any longer text since common letters like e/a/t/n/s
  recur throughout normal English. Fixed by switching to a repeated-run
  check, which is length-invariant.)
- **Category mismatch warning**: if the caller explicitly overrides
  `category` and it disagrees with what `classify_category_v2` would have
  auto-detected, `category_mismatch_warning` is set in the response (the
  override is still honored — this only warns, never silently corrects).
- **Ticker mismatch warning**: if the headline doesn't appear to mention the
  selected company (fuzzy match against the company name with generic
  corporate words like "PLC"/"Bank"/"Holdings" stripped out, or the ticker's
  base symbol), `ticker_mismatch_warning` is set the same way.

Both warnings render as an amber notice on `ResultsCard`, visually separate
from the prediction itself.

## Known limitations (by design, not oversights)

- **CSE session token requires manual refresh.** See above — this is a
  deliberate tradeoff, not an oversight.
- **Market-wide volatility is a documented static default, not live** (no
  public CSE index-volatility endpoint). Clearly labeled in both the API
  response and the UI.
- **Sentiment is a separate, unvalidated signal.** The off-the-shelf FinBERT
  sentiment score shown on the results page was never tested against this
  dataset's true CAR direction. It's visually de-emphasized (muted, dashed
  border, separate section) from the validated magnitude/significance
  result on purpose — don't merge them.
- **Direction is not predicted.** Only reaction *magnitude* is modeled;
  direction was tested and found unlearnable from text.
- **Limited sensitivity to specific numeric values in headline text** —
  e.g. changing a bond issuance from "$750m" to "$10000m" barely moves the
  predicted magnitude. A known, structural limitation of BERT-style text
  encoders (weak at extracting/reasoning about numeric magnitudes from raw
  text), not specific to this implementation. Documented on the Validation
  page rather than papered over.
- No auth (for our own app), no database, no state management library —
  unneeded at this scope.
#   F u t u r e S c o p e  
 