import asyncio
import httpx
from datetime import date, datetime
from sqlalchemy import text
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
    async with sem:
        try:
            resp = await client.get(f"{MFAPI_BASE}/{scheme_code}", timeout=30)
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
        if since_date and nav_date <= since_date:
            continue
        rows.append({"scheme_code": scheme_code, "nav_date": nav_date, "nav_value": nav_value})

    return rows


async def check_and_load_nav(db: Session):
    """Delta-load NAV from mfapi for any scheme not current as of today."""
    scheme_codes = [s.scheme_code for s in db.query(SchemeDetail.scheme_code).all()]
    if not scheme_codes:
        print("[MFAPI] No schemes found — skipping NAV load.")
        return

    trackers = {t.scheme_code: t.latest_nav_date for t in db.query(MfapiReloadTracker).all()}
    today = date.today()
    to_update = [c for c in scheme_codes if c not in trackers or trackers[c] < today]

    if not to_update:
        print("[MFAPI] NAV data is up to date for all schemes.")
        return

    print(f"[MFAPI] Delta-loading NAV for {len(to_update)} schemes (concurrency={SEMAPHORE_LIMIT})...")

    # Async fetch — producer fills queue
    queue: asyncio.Queue[list[dict]] = asyncio.Queue()
    sem = asyncio.Semaphore(SEMAPHORE_LIMIT)

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *[_fetch_scheme_nav(client, sem, code, trackers.get(code)) for code in to_update]
        )

    for rows in results:
        await queue.put(rows)

    # Drain queue → batch insert
    total = 0
    batch: list[dict] = []
    while not queue.empty():
        batch.extend(queue.get_nowait())
        if len(batch) >= BATCH_SIZE:
            _insert_batch(db, batch)
            total += len(batch)
            batch = []

    if batch:
        _insert_batch(db, batch)
        total += len(batch)

    print(f"[MFAPI] Inserted {total} new NAV rows.")

    # Update tracker per scheme
    for code in to_update:
        latest = (
            db.query(NavDetail.nav_date)
            .filter(NavDetail.scheme_code == code)
            .order_by(NavDetail.nav_date.desc())
            .first()
        )
        if not latest:
            continue
        tracker = db.query(MfapiReloadTracker).filter(MfapiReloadTracker.scheme_code == code).first()
        if tracker:
            tracker.latest_nav_date = latest.nav_date
        else:
            db.add(MfapiReloadTracker(scheme_code=code, latest_nav_date=latest.nav_date))

    db.commit()

    # Gap-fill weekends / holidays by carrying forward last observed NAV
    print(f"[MFAPI] Running gap-fill for {len(to_update)} schemes...")
    _gap_fill(db, to_update)
    print("[MFAPI] NAV load complete.")


def _insert_batch(db: Session, batch: list[dict]):
    if not batch:
        return
    db.execute(
        text("""
            INSERT INTO nav_details (scheme_code, nav_date, nav_value)
            VALUES (:scheme_code, :nav_date, :nav_value)
            ON CONFLICT (scheme_code, nav_date) DO NOTHING
        """),
        batch,
    )
    db.commit()


def _gap_fill(db: Session, scheme_codes: list[str]):
    """Fill missing dates within each scheme's NAV range (carries forward last known NAV)."""
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
