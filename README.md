# Pantry Pass Boston (BU_hack26)

**BostonHacks 2026 · Boundless Boston track**

Boston residents may live near a food pantry but not know what's on the shelves, how to use it, or what they could cook.
Pantry Pass is a community-powered platform where residents **discover local pantries**, **share recipes made with pantry food**,
and **earn points toward custom CharlieCards and T-passes** for helping neighbors. University students are the launch community.

> "Pantry Pass" is a working name. The seeded pantry names, addresses, coordinates, and phone numbers are real
> Boston listings from a public City of Boston GIS layer sourced from the Greater Boston Food Bank in September 2021.
> Details may have changed, so the app tells users to call or check the current GBFB locator before visiting.
> Inventory, recipes, ratings, activity, and users are explicitly demo data.

## What's in v1

| Proposal workflow | v1 feature |
|---|---|
| 1. Explore nearby pantries (inventory level, goods, features, rating, distribution model, hours) | Boston map with T lines and pins colored by stock level, sorted by distance from you (tap the map to move); filters for open today, distribution model and features; pantry page with hours, shelf by category, ratings, "N people cooked from here this month" |
| 2. Upload dishes and recipes, plus where the food came from; tag by culture or diet | "Share a dish" form with pantry, ingredients, steps, photo, culture and dietary tags |
| 3. Rate others' dishes (taste, ease of preparation) | Rating on two criteria; you can't rate your own dish, and re-rating updates without double points |
| 4. Weekly and monthly rankings with prizes | Leaderboard by week, month or all time, grouped by contributor, university or T line; prize tiers; top community recipes |
| Participation points | Recipe +20, photo +10, rate a recipe +5, rate a pantry +5, check in +10, report stock +5, submit a pantry +30 once verified (`backend/app/points.py`) |
| Pinging and alerts | Dish or culture, then a search radius, then rules for when to ping you (a pantry has X% of the ingredients, or someone shares a matching recipe) |
| Gemini meal ideas | "What can I cook with this?" on each pantry, using its current stock plus your diet and cuisine |
| Tiger Data | SQLAlchemy models run on Postgres/Tiger Data; `backend/sql/tiger_setup.sql` turns inventory and points into hypertables |
| Private transit help | One-time browser geolocation, live nearby MBTA v3 stops/predictions/alerts, and a transit-directions handoff that never stores or returns the origin |

## Architecture

```
React + TypeScript (Vite)      frontend/
        |  /api
FastAPI                        backend/app/main.py
   |                 |                    |
Tiger Data       Gemini API          MBTA v3 API
(Postgres)       (meal ideas)        (live transit)
```

- **No setup needed for a demo:** the frontend uses the API when it responds. Otherwise it runs the same rules on in-browser demo data (`frontend/src/demo/mock.ts`).
- **Auth is stubbed.** The user dropdown in the header sends `X-User-Id`. Replace it with real auth after the hackathon.
- **Precise location is request-scoped.** Nearby pantry distances are calculated in the browser. Directions use a one-time,
  anonymous POST request with no database write or cache. The server rounds the origin to about 100 meters before querying
  MBTA for nearby stops, and the external directions URL omits the origin. Food alerts save only a coarsened map area, not the
  precise device coordinate.
- **Alert engine** (`backend/app/alerts.py`): stores your dish, its ingredients and a radius, then matches them against fresh (≤7 days) pantry stock, filters by distance, and notifies on a stock update or a new matching recipe. It won't send the same ping twice within 24 hours.

## Run it

```bash
# backend (Python 3.11+)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload            # http://localhost:8000/docs ; seeds SQLite on first run
pytest -q                                # 7 API tests

# frontend (Node 20+)
cd frontend
npm install
npm run dev                              # http://localhost:5173  (proxies /api to :8000)
npm run build:demo                       # single-file dist-demo/index.html, no backend needed
```

### Environment variables (backend)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Tiger Data connection string, e.g. `postgresql+psycopg://tsdbadmin:PASS@HOST:PORT/tsdb?sslmode=require`. SQLite is used if unset. |
| `GEMINI_API_KEY` | Turns on Gemini meal suggestions. Without it, rule-based ideas are used. |
| `GEMINI_MODEL` | Defaults to `gemini-2.5-flash` |
| `MBTA_API_KEY` | Optional server-side MBTA v3 key for live nearby stops, predictions, and alerts. Never exposed to the frontend. |
| `CORS_ORIGINS` | Comma-separated origins (default `*`) |

Frontend: `VITE_API_URL` if the API isn't served from the same origin.

## Demo script (3 minutes)

1. **Pantries:** choose **Use my location**, tap a real pantry pin, view the clearly labeled demo shelf, then try **Get transit directions**.
2. **Meals:** choose **Suggest meals** and **Check in** (+10 toast).
3. **Recipes:** open a dish and rate taste and ease (+5).
4. Switch the header user to **Diego R.**, share "Kimchi fried rice" from Rice Sticks and Tea / Asian Food Pantry.
5. Switch back to **Grace K.**. **Alerts** shows a badge: her fried-rice alert fired.
6. **Leaderboard:** flip between this week and universities or T lines; prizes are shown per rank.

## Next steps

- Arrange a licensed current feed with GBFB/Vivery or Mass211 and add a pantry verification queue; the public seed is real but historical
- Replace the external route handoff with self-hosted OpenTripPlanner for in-app door-to-door MBTA itineraries
- Real auth (BU / .edu SSO), photo storage (S3/GCS) instead of data URIs
- Push or email delivery for alerts, and a scheduled job to settle weekly winners
- Gemini: substitutions per user pantry, translation of recipes for multilingual neighbors

## Repo layout

```
data/seed.json          sourced pantry directory records plus shared demo users/activity
data/demo_inventory.csv explicitly synthetic shelf inventory for backend and browser demo mode
backend/app/            FastAPI app: models, points, alerts, gemini, seed
backend/sql/            Tiger Data hypertables & views
backend/tests/          pytest API tests
frontend/src/           React app (views/, components/, demo/mock.ts, geo.ts)
```
