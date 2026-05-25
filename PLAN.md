# Mutual Funds Screener (MFSelect)

## Phase 0 - Verify database connectivity ✅ COMPLETE
- Connect to the database instance using the hostname, username, password, port details available in the .env file and confirm that is working fine.

### Validation Results
- **PostgreSQL version:** 18.3 on aarch64-unknown-linux-gnu (AWS RDS)
- **Host:** database-1.c6nvu354y8s3.us-east-1.rds.amazonaws.com:5432
- **Database:** `mfscreener` confirmed reachable
- **GET /health response:** `{"status": "ok", "host": "database-1.c6nvu354y8s3.us-east-1.rds.amazonaws.com", "database": "mfscreener"}`
- **Files created:** `backend/config.py`, `backend/database.py`, `backend/main.py`, `backend/requirements.txt`

## Phase 1 - Login Module ✅ COMPLETE
- A table `users` within the database `mfscreener` with 1 default record `admin`, with password `password`.
- A POST endpoint `/login` — validates credentials; returns 200 `Login Successful` or 401 `Login Failed`.
- Frontend: login form page.

### Validation Results
- **POST /login** (admin/password) → `200 {"message": "Login Successful"}`
- **POST /login** (admin/wrong) → `401 {"detail": "Login Failed"}`
- **Frontend** login form tested end-to-end; successful login redirects to `/dashboard`
- **Files created:** `backend/models.py`, `backend/routers/auth.py`, `frontend/app/login/page.tsx`, `frontend/app/dashboard/page.tsx`

## Phase 2 — Mutual Fund Details Module ✅ COMPLETE
- Fetch the Scheme Details of all the Mutual Fund Schemes available within India from the site - https://portal.amfiindia.com/spages/NAVAll.txt. 
- This file includes blank lines and raw text headers (e.g.- Open Ended Schemes(Debt Scheme - Banking and PSU Fund)) interleaved between blocks of data. Parser must dynamically capture the header lines as it streams through rows to correctly extract the Scheme Category and Scheme Type for downstream rows.
- Filter and remove any schemes that are inactive - carry the keyword `discontinued` in the Scheme Name.
- IMPORTANT: Please filter on only the following Scheme Categories for now - `Equity Scheme - Flexi Cap Fund` and `Equity Scheme - Multi Cap Fund`.
- Store this data in a table named `scheme_details` within the database `mfscreener`. This must include - Fund House (e.g.- Aditya Birla Sun Life Mutual Fund), Scheme Type (e.g.- Open Ended or Close Ended), Scheme Category (e.g.- Debt Scheme - Banking and PSU Fund), Scheme Code (e.g.- 119551), Scheme Name (e.g.- Aditya Birla Sun Life Banking & PSU Debt Fund). No need to store the Net Asset Value and Date as we will be fetching that through different means. 
- Implement backend logic to do a complete reload of this data on a daily basis. Use a separate metadata table named `amfi_reload_tracker` within the database `mfscreener` to track the last_data_reload date.  When the application runs for the first time, it should check what was the last_reload_date and if it is not the same as today, it should do a complete reload of the data. For now, no need to implement any orchestration logic to perform this reload on a daily basis if the application has been running continously. 
- Create /schemes GET endpoint to retrieve Scheme details of all the schemes from the `scheme_details` table.
- Use the Scheme codes retrieved from the /schemes GET endpoint, to fetch NAV details about each scheme from the API - https://api.mfapi.in/mf/{scheme_code}. 
- Leverage an asynchronous worker pool pattern using Python’s httpx or aiohttp along with a semaphore limit (e.g.- max 10–20 concurrent requests) to avoid crashing the worker or getting blacklisted by MFAPI. 
- Dump the data into an in-memory queue. 
- Take the data from the in-memory queue and write it to a table named `nav_details` within `mfscreener` database in batches of 5000 to 10000 rows per transaction. Create a composite index on (scheme_code, nav_date).
- Use a single-row metadata table `mfapi_reload_tracker` (columns: `id`, `last_data_reload`) to track when NAV data was last loaded. On application startup: for each scheme that has no existing rows in `nav_details` perform a full historical load (no date filter); for schemes that already have data and `last_data_reload < today` perform a delta load using `https://api.mfapi.in/mf/{scheme_code}?startDate=YYYY-MM-DD` with `last_data_reload` as the startDate (the API accepts `YYYY-MM-DD` format). New rows are appended with `ON CONFLICT DO NOTHING`. Update `last_data_reload` to today after a successful load. For now, no need to implement any orchestration logic to perform this delta load on a daily basis if the application has been running continuously.
- Use Postgres generate_series() capability to address any gaps within the NAV data e.g.- the NAV will be missing for Saturdays and Sundays. In that case, the Last Observed NAV must be carry forwarded.
- Create /nav/{scheme_code} GET endpoint to retrieve NAV details of all the schemes from the `nav_details` table. Add query parameters for Start Date and End Date.

### Validation Results
- **scheme_details:** 309 schemes loaded (Flexi Cap + Multi Cap only)
- **nav_details:** 843,989 rows after gap-fill; date range 2006-04-02 to 2026-05-22
- **GET /schemes** → returns all 309 schemes ordered by name
- **GET /nav/{scheme_code}** → returns NAV rows with optional start_date/end_date filters
- **Daily reload:** single-row `mfapi_reload_tracker` checked on startup; new schemes get full load, existing schemes get delta via `?startDate=DD-MM-YYYY`; skipped if already current
- **Dashboard:** scheme list table with live search and category badge visible post-login
- **Files created/modified:** `backend/services/amfi.py`, `backend/services/nav.py`, `backend/routers/schemes.py`, `backend/models.py`, `frontend/app/dashboard/page.tsx`

## Phase 3 — Mutual Fund Screener Module ✅ COMPLETE

- Bulk-read NAV data from `nav_details` into memory and use **pandas rolling windows** (not SQL) to calculate the date wise - 1 Year (1Y), 3 Year (3Y), 5 Year (5Y) Rolling returns (annualised CAGR) and Rolling Standard Deviations (annualised via sqrt(252)) of each Scheme. SQL window functions were evaluated but caused RDS connection drops on large datasets; pandas proved more reliable and faster for this volume. 
- These must be calculated on a daily basis. Please use a metadata table named `metrics_calculation_tracker` within the database `mfscreener` to maintain latest_nav_date_factored_in_calculations per scheme separately for ease of reference. When the application runs for the first time, it should check what was the latest_nav_date_factored_in_calculation per scheme and if it is not the same as today for any scheme, it should do the calculations for the missed dates. For now, no need to implement any orchestration logic to perform this process on a daily basis if the application has been running continously. 
- Store the results in tables named `rolling_return_details` (for Rolling Returns) and `rolling_risk_details` (for Rolling Standard Deviations) within the database `mfscreener`. Create composite index on (scheme_code, nav_date).
- Create /returns/{scheme_code} GET endpoint to retrieve Rolling 1Y, 3Y, 5Y Returns of each scheme from the 'rolling_return_details' table. Add query parameters for Start Date and End Date.
- Create /risk/{scheme_code} GET endpoint to retrieve Rolling 1Y, 3Y, 5Y Standard Deviations of each scheme from the 'rolling_risk_details' table. Add query parameters for Start Date and End Date.
- Create /returns_summary/{scheme_code} and /risk_summary/{scheme_code} GET endpoints that support query parameters for Start Date and End Date. For a given Scheme Code, Start Date and End Date, these endpoints run SQL MIN/MAX/AVG **on the fly** against the pre-computed rows in `rolling_return_details` / `rolling_risk_details` filtered by the supplied date range — the summary statistics are not stored separately.
- Build the Frontend to display filters for Scheme Category. For the given filter selection, display all the Schemes' Details along with associated Minimum, Maximum and Average 1Y, 3Y and 5Y Rolling Returns and Rolling Standard Deviations.

### Validation Results
- **rolling_return_details:** 734,557 rows across 309 schemes
- **rolling_risk_details:** 731,680 rows across 309 schemes
- **metrics_calculation_tracker:** 309/309 schemes tracked
- **Calculation method:** pandas rolling windows (1Y=365d, 3Y=1095d, 5Y=1825d); returns as annualised CAGR; SD annualised via sqrt(252)
- **GET /returns/{scheme_code}**, **GET /risk/{scheme_code}** → time-series with optional start_date/end_date
- **GET /returns_summary/{scheme_code}**, **GET /risk_summary/{scheme_code}** → Min/Max/Avg per horizon with optional date range
- **GET /screener** → single aggregated endpoint used by dashboard; accepts category, start_date, end_date
- **Dashboard:** screener table with category dropdown, date range pickers, search, and Min/Max/Avg columns for all 6 metric series
- **Files created/modified:** `backend/models.py`, `backend/services/metrics.py`, `backend/routers/metrics.py`, `backend/main.py`, `frontend/app/dashboard/page.tsx`

### Phase 4 — Mutual Fund Watchlist Module
- Enhance the frontend to allow the user to select and save any Mutual Fund Scheme (chosen based on its summary statistics) to a Watchlist.
- The Scheme code must stored in a table named `watchlist_details` within the database `mfscreener`. 
- Also add Frontend panels to select schemes from the watchlist, choose specific Start and End Date, and see the Scheme Details, Daily NAV trends visualizations, and Minimum, Maximum and Average 1Y, 3Y and 5Y Rolling Returns and Rolling Standard Deviation in a tabular form.