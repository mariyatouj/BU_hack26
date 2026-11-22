# SaverMeal Boston

SaverMeal connects a reachable Boston pantry session to recipes, a private pickup record and simulated transit or museum rewards. Explore works without an account or location permission. Eight fictional pantries use real MBTA geography and twenty original recipes. For actual food distribution, use the GBFB locator under **Access help**.

## Run

Use Node 22.18+ or a newer supported LTS release, npm, and Python 3.11+ for data validation and the optional API.

```sh
cd frontend
npm ci
npm run dev
```

Open the local Vite URL. The app stores pickups, photos and the wallet in IndexedDB. Tabs on the same origin share updates. The built-in clock starts at 11 a.m. Boston time on November 21, 2026. **Pantry editor → Reset demo → Confirm reset** restores all eight sessions, the 200-point opening credit and reward stock.

```sh
npm run validate:data
npm test
npm run lint
npm run build
npm run build:demo
npm run preview
```

The static deployment directory is `frontend/dist`. The portable offline build is `frontend/dist-demo/index.html`. Browser storage is scoped to the site or local file context. Use one consistent origin for a presentation. A local preview or a static host serves the full primary journey at zero incremental software cost.

## Optional connected features

```sh
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q
.venv/bin/uvicorn app.main:app --reload
```

Vite dev proxies `/api` to localhost:8000. A hosted frontend can set `VITE_API_URL` at build time. The API accepts optional `GEMINI_API_KEY`, `GEMINI_MODEL`, `MBTA_API_KEY`, `CORS_ORIGINS` and `DATABASE_URL`. The default SQLite database is local to the backend working directory.

- **Check live departures** requests nearby MBTA stops and arrivals once. The server rounds the selected origin before contacting MBTA. The external planner receives only the destination. Transit data and stock have independent timestamps.
- **Cooking guidance** submits catalog ingredient assignments and equipment context for the selected recipe. Gemini can select and sequence reviewed guidance. The server checks compatible ingredient roles and allowed response indices. Catalog guidance is available without a key or network. Meal photos stay local.
- Historical v1 directory and activity endpoints remain available to existing clients. New public meal uploads return HTTP 410. Community actions earn zero cooking points. Historical activity is independent of the private browser wallet.

## Verification and demonstration

After building both outputs, run `npm run test:e2e` in `frontend` with Chrome installed. Alternatively install Playwright Chromium and set `PW_CHANNEL=chromium`. Browser checks exercise the local preview, private cooking journey, shared state, stock contention, cancellation, mobile layout, offline directions and the portable build. To record the browser flows, install Playwright FFmpeg and set `RECORD_DEMO=1`. Run `npm run record:demo` to regenerate thehow to  captioned presenter walkthrough from the production build.

[Walkthrough video](docs/walkthrough.webm) · [Presenter script and acceptance checklist](docs/demo-script.md) · [Sources and design decisions](docs/sources.md)
