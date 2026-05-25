import math
import time
from datetime import date

import pandas as pd
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from database import SessionLocal
from models import (
    MetricsCalculationTracker,
    RollingReturnDetail,
    RollingRiskDetail,
    SchemeDetail,
)

BATCH_SIZE = 10000


def check_and_calculate_metrics(db: Session):
    scheme_codes = [s.scheme_code for s in db.query(SchemeDetail.scheme_code).all()]
    if not scheme_codes:
        print("[Metrics] No schemes found — skipping.")
        return

    trackers = {
        t.scheme_code: t.latest_nav_date_factored
        for t in db.query(MetricsCalculationTracker).all()
    }
    latest_nav = {
        row[0]: row[1]
        for row in db.execute(
            text("SELECT scheme_code, MAX(nav_date) FROM nav_details GROUP BY scheme_code")
        ).fetchall()
    }

    to_update = [
        c for c in scheme_codes
        if c in latest_nav and (c not in trackers or trackers[c] < latest_nav[c])
    ]
    if not to_update:
        print("[Metrics] Rolling metrics are up to date for all schemes.")
        return

    print(f"[Metrics] Calculating rolling metrics for {len(to_update)} schemes...")

    # --- Step 1: bulk-read all needed NAV data in one query ---
    print("[Metrics] Fetching NAV data...")
    placeholders = ", ".join(f"'{c}'" for c in to_update)
    nav_rows = db.execute(
        text(
            f"SELECT scheme_code, nav_date, nav_value "
            f"FROM nav_details WHERE scheme_code IN ({placeholders}) "
            f"ORDER BY scheme_code, nav_date"
        )
    ).fetchall()

    nav_df = pd.DataFrame(nav_rows, columns=["scheme_code", "nav_date", "nav_value"])
    nav_df["nav_value"] = nav_df["nav_value"].astype(float)
    print(f"[Metrics] Loaded {len(nav_df):,} NAV rows into memory.")

    # --- Step 2: compute metrics per scheme in pandas ---
    return_records: list[dict] = []
    risk_records: list[dict] = []

    for i, sc in enumerate(to_update, 1):
        since = trackers.get(sc, date(1900, 1, 1))
        sc_df = nav_df[nav_df["scheme_code"] == sc].set_index("nav_date").sort_index()
        nav = sc_df["nav_value"]
        daily_ret = nav.pct_change()

        return_1y = (nav / nav.shift(365)) - 1
        return_3y = (nav / nav.shift(1095)) ** (1 / 3) - 1
        return_5y = (nav / nav.shift(1825)) ** (1 / 5) - 1
        sd_1y = daily_ret.rolling(365).std() * math.sqrt(252)
        sd_3y = daily_ret.rolling(1095).std() * math.sqrt(252)
        sd_5y = daily_ret.rolling(1825).std() * math.sqrt(252)

        metrics = pd.DataFrame({
            "return_1y": return_1y, "return_3y": return_3y, "return_5y": return_5y,
            "sd_1y": sd_1y, "sd_3y": sd_3y, "sd_5y": sd_5y,
        })
        new = metrics[metrics.index > since]

        for nav_date, row in new.iterrows():
            r1 = _r(row["return_1y"]); r3 = _r(row["return_3y"]); r5 = _r(row["return_5y"])
            s1 = _r(row["sd_1y"]);     s3 = _r(row["sd_3y"]);     s5 = _r(row["sd_5y"])
            if any(v is not None for v in (r1, r3, r5)):
                return_records.append({"scheme_code": sc, "nav_date": nav_date,
                                       "return_1y": r1, "return_3y": r3, "return_5y": r5})
            if any(v is not None for v in (s1, s3, s5)):
                risk_records.append({"scheme_code": sc, "nav_date": nav_date,
                                     "sd_1y": s1, "sd_3y": s3, "sd_5y": s5})

        if i % 50 == 0:
            print(f"[Metrics]   {i}/{len(to_update)} schemes computed")

    print(f"[Metrics] Computed {len(return_records):,} return rows, {len(risk_records):,} risk rows.")

    # --- Step 3: write everything in batched inserts ---
    _flush_all(RollingReturnDetail, return_records)
    _flush_all(RollingRiskDetail, risk_records)

    # --- Step 4: update tracker for all schemes ---
    _update_all_trackers(to_update, latest_nav)

    print("[Metrics] Rolling metrics calculation complete.")


def _r(v):
    if pd.isna(v) or math.isinf(v):
        return None
    return round(float(v), 6)


def _flush_all(model, records: list[dict]):
    if not records:
        return
    for attempt in range(4):
        try:
            db = SessionLocal()
            try:
                for start in range(0, len(records), BATCH_SIZE):
                    chunk = records[start: start + BATCH_SIZE]
                    db.execute(
                        pg_insert(model.__table__).values(chunk).on_conflict_do_nothing(
                            index_elements=["scheme_code", "nav_date"]
                        )
                    )
                db.commit()
                return
            finally:
                db.close()
        except Exception as e:
            if attempt == 3:
                raise
            wait = 2 ** attempt
            print(f"[Metrics] Write retry {attempt+1} in {wait}s: {e}")
            time.sleep(wait)


def _update_all_trackers(scheme_codes: list[str], latest_nav: dict):
    rows = [{"scheme_code": sc, "latest_nav_date_factored": latest_nav[sc]} for sc in scheme_codes]
    for attempt in range(4):
        try:
            db = SessionLocal()
            try:
                for start in range(0, len(rows), 200):
                    chunk = rows[start: start + 200]
                    db.execute(
                        pg_insert(MetricsCalculationTracker.__table__)
                        .values(chunk)
                        .on_conflict_do_update(
                            index_elements=["scheme_code"],
                            set_={"latest_nav_date_factored": text("EXCLUDED.latest_nav_date_factored")},
                        )
                    )
                db.commit()
                return
            finally:
                db.close()
        except Exception as e:
            if attempt == 3:
                raise
            wait = 2 ** attempt
            print(f"[Metrics] Tracker retry {attempt+1} in {wait}s: {e}")
            time.sleep(wait)
