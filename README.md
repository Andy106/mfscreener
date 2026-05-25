# MFSelect — Indian Mutual Fund Screener

A full-stack web application for discovering, screening, and tracking Indian Mutual Fund schemes. Built with **FastAPI**, **Next.js**, and **PostgreSQL (AWS RDS)**.

---

## Features

| Module | Capability |
|---|---|
| **Login** | Single-user authentication with bcrypt-hashed password |
| **Screener** | Filter schemes by category & date range; view Min / Max / Avg rolling returns and risk across 1Y / 3Y / 5Y horizons |
| **Watchlist** | Star any scheme from the screener; view its NAV trend chart and summary statistics |

**Data sources:**
- Scheme catalogue — [AMFI NAVAll.txt](https://portal.amfiindia.com/spages/NAVAll.txt) (reloaded daily)
- Historical NAV — [mfapi.in](https://api.mfapi.in) (full load on first run, delta load daily)

**Scheme coverage (current):** Equity Flexi Cap + Multi Cap — 309 active schemes.

---

## Screenshots

### Login
![Login screen](docs/screenshots/login.png)

```
┌──────────────────────────────────┐
│           MFSelect               │
│                                  │
│  Username  [admin____________]   │
│  Password  [****************]   │
│                                  │
│         [ Login ]                │
└──────────────────────────────────┘
```

### Screener — Filter Panel + Results Table
![Screener dashboard](docs/screenshots/screener.png)

```
┌────────────────────┬─────────────────────────────────────────────────────────┐
│ Category           │  309 schemes                                            │
│ [Flexi Cap ▾]      │ ┌──────────────┬──────────────┬──────────────┬───────┐  │
│                    │ │ Scheme       │  1Y Return   │  3Y Return  │  ...  │  │
│ Start Date         │ │              ├──────────────┼─────────────┼───────┤  │
│ [2015-01-01]       │ │              │ Min Max Avg  │ Min Max Avg │       │  │
│                    │ ├──────────────┼──────────────┼─────────────┼───────┤  │
│ End Date           │ │ Axis MF ...  │ 6% 45% 18%  │  8% 22% 15%│  ☆   │  │
│ [2026-05-25]       │ │ HDFC Flexi.. │ 5% 38% 16%  │  7% 20% 13%│  ★   │  │
│                    │ │ ...          │ ...          │ ...         │       │  │
│ Schemes (309/309)  │ └──────────────┴──────────────┴─────────────┴───────┘  │
│ [Search schemes..] │                                                         │
│ ☑ All              │                                                         │
│ ☑ Axis Flexi Cap.. │                                                         │
│ ☑ HDFC Flexi Cap.. │                                                         │
│ ...                │                                                         │
│ [ Apply ]          │                                                         │
└────────────────────┴─────────────────────────────────────────────────────────┘
```

### Watchlist — NAV Trend + Summary Statistics
![Watchlist page](docs/screenshots/watchlist.png)

```
┌────────────────────┬─────────────────────────────────────────────────────────┐
│ Watchlist (3)      │  HDFC Flexi Cap Fund                                    │
│                    │  HDFC Asset Management · Flexi Cap · Open Ended         │
│ ★ HDFC Flexi Cap  │                                                         │
│   HDFC AMC     ✕  │  Start [2015-01-01]  End [2026-05-25]  [ Apply ]        │
│                    │                                                         │
│   Axis Flexi Cap  │  Daily NAV Trend                                        │
│   Axis AMC     ✕  │  ₹900 ┤                                        ╭───     │
│                    │  ₹600 ┤                              ╭─────────╯        │
│   Parag Parikh    │  ₹300 ┤          ╭──────────────────╯                   │
│   PPFAS AMC    ✕  │  ₹100 ┼──────────╯                                      │
│                    │       2015   2017   2019   2021   2023   2026           │
│                    │                                                         │
│                    │  Rolling Returns & Risk Summary                         │
│                    │  ┌─────────────────┬────────┬────────┬────────┐        │
│                    │  │ Metric          │  Min   │  Max   │  Avg   │        │
│                    │  ├─────────────────┼────────┼────────┼────────┤        │
│                    │  │ 1Y Rolling Ret  │  -8%   │  76%   │  18%   │        │
│                    │  │ 3Y Rolling Ret  │   6%   │  30%   │  16%   │        │
│                    │  │ 5Y Rolling Ret  │   8%   │  24%   │  15%   │        │
│                    │  │ 1Y Rolling SD   │   8%   │  32%   │  18%   │        │
│                    │  │ 3Y Rolling SD   │  10%   │  26%   │  17%   │        │
│                    │  │ 5Y Rolling SD   │  12%   │  24%   │  17%   │        │
│                    │  └─────────────────┴────────┴────────┴────────┘        │
└────────────────────┴─────────────────────────────────────────────────────────┘
```

> **Note:** Replace the placeholder images above by dropping real screenshots into `docs/screenshots/` and pushing them.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Recharts |
| Backend | Python 3 · FastAPI · SQLAlchemy 2 · pandas · httpx |
| Database | PostgreSQL 18 (AWS RDS) |
| Data | AMFI (scheme catalogue) · mfapi.in (historical NAV) |

---

## Architecture

```
Browser (Next.js)
      │  REST (JSON)
      ▼
FastAPI (Python)
  ├── /login              POST — bcrypt auth
  ├── /schemes            GET  — all scheme details
  ├── /nav/{code}         GET  — daily NAV with optional date filter
  ├── /screener           GET  — aggregated rolling returns + SD per scheme
  ├── /returns/{code}     GET  — time-series 1Y/3Y/5Y rolling returns
  ├── /risk/{code}        GET  — time-series 1Y/3Y/5Y rolling SD
  ├── /returns_summary/   GET  — Min/Max/Avg returns for a scheme + date range
  ├── /risk_summary/      GET  — Min/Max/Avg SD for a scheme + date range
  ├── /watchlist          GET  — watchlisted schemes
  ├── /watchlist/{code}   POST — add to watchlist
  └── /watchlist/{code}   DELETE — remove from watchlist
      │
      ▼
AWS RDS PostgreSQL
  ├── users
  ├── scheme_details         (309 schemes: Flexi Cap + Multi Cap)
  ├── nav_details            (~844K rows, gap-filled via generate_series)
  ├── rolling_return_details (~735K rows — pandas rolling CAGR)
  ├── rolling_risk_details   (~732K rows — pandas rolling SD × √252)
  ├── amfi_reload_tracker    (last AMFI reload date)
  ├── mfapi_reload_tracker   (last NAV delta load date)
  ├── metrics_calculation_tracker (per-scheme latest NAV date factored)
  └── watchlist_details      (saved scheme codes)
```

---

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- A PostgreSQL database (AWS RDS or local)

### 1. Clone

```bash
git clone https://github.com/Andy106/mfscreener.git
cd mfscreener
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file (never committed):

```env
DB_HOSTNAME=<your-rds-host>
DB_PORT=5432
DB_NAME=mfscreener
DB_USERNAME=<db-user>
DB_PASSWORD=<db-password>
```

Start the API:

```bash
uvicorn main:app --reload --port 8000
```

On first startup the API will:
1. Create all tables automatically
2. Seed the `admin` user (password: `password`)
3. Download and parse ~7,000+ schemes from AMFI, filter to the target categories, and load `scheme_details`
4. Fetch full historical NAV from mfapi.in for all 309 schemes into `nav_details` (this can take 10–20 minutes on first run)
5. Compute rolling returns and standard deviations into `rolling_return_details` and `rolling_risk_details` via pandas (this can take 5–10 minutes on first run)

Subsequent startups skip steps 3–5 if the data was already loaded today.

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with `admin` / `password`.

---

## Data Model

### Rolling Returns — `rolling_return_details`

| Column | Type | Notes |
|---|---|---|
| scheme_code | TEXT PK | |
| nav_date | DATE PK | |
| return_1y | NUMERIC | Annualised CAGR over 365 calendar days |
| return_3y | NUMERIC | Annualised CAGR over 1095 calendar days |
| return_5y | NUMERIC | Annualised CAGR over 1825 calendar days |

### Rolling Risk — `rolling_risk_details`

| Column | Type | Notes |
|---|---|---|
| scheme_code | TEXT PK | |
| nav_date | DATE PK | |
| sd_1y | NUMERIC | Rolling 365-day daily-return SD × √252 |
| sd_3y | NUMERIC | Rolling 1095-day daily-return SD × √252 |
| sd_5y | NUMERIC | Rolling 1825-day daily-return SD × √252 |

Weekend / holiday NAV gaps are filled with the last observed NAV using PostgreSQL `generate_series()`.

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Pandas for rolling metrics (not SQL window functions) | SQL CTEs with `LAG` + `STDDEV` over 844K rows caused RDS connection drops; pandas bulk-read is faster and more stable |
| Single-row `mfapi_reload_tracker` (not per-scheme date) | Simpler logic; new schemes get full load, existing schemes get delta via `?startDate=YYYY-MM-DD` |
| Screener uses explicit Apply button | Avoids auto-fetching summary stats for 309 schemes on every page load |
| Recharts NAV chart thinned to ≤1,000 points | Full 20-year daily data (~5,000 points per scheme) causes DOM lag in the browser |

---

## Project Status

| Phase | Module | Status |
|---|---|---|
| 0 | DB connectivity | ✅ Complete |
| 1 | Login | ✅ Complete |
| 2 | Scheme & NAV data loading | ✅ Complete |
| 3 | Rolling returns & screener | ✅ Complete |
| 4 | Watchlist | ✅ Complete |
