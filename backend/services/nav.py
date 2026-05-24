import asyncio
import httpx
from datetime import date, datetime
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from models import SchemeDetail, NavDetail, MfapiReloadTracker

MFAPI_BASE = "https://api.mfapi.in/mf"
SEMAPHORE_LIMIT = 15
BATCH_SIZE = 7500


async def _fetch_scheme_nav(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    scheme_code: str,
    since_date: date | None,
) -> list[dict]:
    """Fetch NAV for one scheme. since_date=None means full historical load."""
    async with sem:
        try:
            url = f"{MFAPI_BASE}/{scheme_code}"
            if since_date:
                url += f"?startDate={since_date.strftime('%Y-%m-%d')}"
            resp = await client.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[MFAPI] Failed {scheme_code}: {e}")
            return []

    rows = []
    for entry in data.get("data", []):
        try:
            nav_date = datetime.strptime(entry["date"], "%d-%m-%Y").date()
            nav_value = float(entry["nav"])
        except (ValueError, KeyError):
            continue
        rows.append({"scheme_code": scheme_code, "nav_date": nav_date, "nav_value": nav_value})

    return rows


async def check_and_load_nav(db: Session):
    """
    On startup:
    - Schemes with no NAV rows → full historical load (no startDate).
    - Schemes with existing rows and last_data_reload < today → delta load
      via ?startDate=DD-MM-YYYY using last_data_reload as the cutoff.
    - Skip entirely if last_data_reload == today.
    """
    tracker = db.query(MfapiReloadTracker).first()
    today = date.today()

    if tracker and tracker.last_data_reload >= today:
        print("[MFAPI] NAV data is up to date.")
        return

    scheme_codes = [s.scheme_code for s in db.query(SchemeDetail.scheme_code).all()]
    if not scheme_codes:
        print("[MFAPI] No schemes found — skipping NAV load.")
        return

    # Schemes that already have NAV data get a date-filtered delta load;
    # newly added schemes get a full historical load.
    loaded_codes = {
        row[0]
        for row in db.execute(
            text("SELECT DISTINCT scheme_code FROM nav_details")
        ).fetchall()
    }

    since = tracker.last_data_reload if tracker else None
    load_type_log = f"delta from {since}" if since else "full load"
    new_schemes = [c for c in scheme_codes if c not in loaded_codes]
    delta_schemes = [c for c in scheme_codes if c in loaded_codes]

    print(
        f"[MFAPI] Loading NAV — {len(new_schemes)} new (full), "
        f"{len(delta_schemes)} existing ({load_type_log}), "
        f"concurrency={SEMAPHORE_LIMIT}"
    )

    sem = asyncio.Semaphore(SEMAPHORE_LIMIT)
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *[_fetch_scheme_nav(client, sem, code, None) for code in new_schemes],
            *[_fetch_scheme_nav(client, sem, code, since) for code in delta_schemes],
        )

    # results order matches: new_schemes first, then delta_schemes
    all_codes = new_schemes + delta_schemes
    total = 0
    batch: list[dict] = []
    updated_schemes: list[str] = []

    for code, rows in zip(all_codes, results):
        if rows:
            updated_schemes.append(code)
            batch.extend(rows)
            if len(batch) >= BATCH_SIZE:
                _insert_batch(db, batch)
                total += len(batch)
                batch = []

    if batch:
        _insert_batch(db, batch)
        total += len(batch)

    print(f"[MFAPI] Inserted {total} new NAV rows.")

    if updated_schemes:
        print(f"[MFAPI] Running gap-fill for {len(updated_schemes)} schemes...")
        _gap_fill(db, updated_schemes)

    if tracker:
        tracker.last_data_reload = today
    else:
        db.add(MfapiReloadTracker(last_data_reload=today))
    db.commit()

    print("[MFAPI] NAV load complete.")


def _insert_batch(db: Session, batch: list[dict]):
    """Bulk upsert — skips rows already present."""
    if not batch:
        return
    stmt = pg_insert(NavDetail.__table__).values(batch).on_conflict_do_nothing(
        index_elements=["scheme_code", "nav_date"]
    )
    db.execute(stmt)
    db.commit()


def _gap_fill(db: Session, scheme_codes: list[str]):
    """Fill missing calendar dates by carrying forward the last known NAV."""
    for scheme_code in scheme_codes:
        db.execute(
            text("""
                WITH date_range AS (
                    SELECT MIN(nav_date) AS min_d, MAX(nav_date) AS max_d
                    FROM nav_details WHERE scheme_code = :sc
                ),
                all_dates AS (
                    SELECT generate_series(min_d, max_d, '1 day'::interval)::date AS d
                    FROM date_range
                ),
                missing_dates AS (
                    SELECT d FROM all_dates
                    EXCEPT
                    SELECT nav_date FROM nav_details WHERE scheme_code = :sc
                )
                INSERT INTO nav_details (scheme_code, nav_date, nav_value)
                SELECT :sc, m.d, nd.nav_value
                FROM missing_dates m
                CROSS JOIN LATERAL (
                    SELECT nav_value FROM nav_details
                    WHERE scheme_code = :sc AND nav_date < m.d
                    ORDER BY nav_date DESC LIMIT 1
                ) nd
                ON CONFLICT (scheme_code, nav_date) DO NOTHING
            """),
            {"sc": scheme_code},
        )
    db.commit()
