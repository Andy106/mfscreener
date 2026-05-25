from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter()


@router.get("/returns/{scheme_code}")
def get_returns(
    scheme_code: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    q = "SELECT nav_date, return_1y, return_3y, return_5y FROM rolling_return_details WHERE scheme_code = :sc"
    params: dict = {"sc": scheme_code}
    if start_date:
        q += " AND nav_date >= :sd"
        params["sd"] = start_date
    if end_date:
        q += " AND nav_date <= :ed"
        params["ed"] = end_date
    q += " ORDER BY nav_date"
    rows = db.execute(text(q), params).fetchall()
    return [
        {"nav_date": str(r[0]), "return_1y": _f(r[1]), "return_3y": _f(r[2]), "return_5y": _f(r[3])}
        for r in rows
    ]


@router.get("/risk/{scheme_code}")
def get_risk(
    scheme_code: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    q = "SELECT nav_date, sd_1y, sd_3y, sd_5y FROM rolling_risk_details WHERE scheme_code = :sc"
    params: dict = {"sc": scheme_code}
    if start_date:
        q += " AND nav_date >= :sd"
        params["sd"] = start_date
    if end_date:
        q += " AND nav_date <= :ed"
        params["ed"] = end_date
    q += " ORDER BY nav_date"
    rows = db.execute(text(q), params).fetchall()
    return [
        {"nav_date": str(r[0]), "sd_1y": _f(r[1]), "sd_3y": _f(r[2]), "sd_5y": _f(r[3])}
        for r in rows
    ]


@router.get("/returns_summary/{scheme_code}")
def get_returns_summary(
    scheme_code: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    return _summary(db, "rolling_return_details", ["return_1y", "return_3y", "return_5y"], scheme_code, start_date, end_date)


@router.get("/risk_summary/{scheme_code}")
def get_risk_summary(
    scheme_code: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    return _summary(db, "rolling_risk_details", ["sd_1y", "sd_3y", "sd_5y"], scheme_code, start_date, end_date)


@router.get("/screener")
def get_screener(
    category: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Returns all schemes with pre-aggregated Min/Max/Avg rolling returns and
    standard deviations. Used by the screener dashboard page.
    """
    date_filter_r = ""
    date_filter_k = ""
    params: dict = {}
    if start_date:
        date_filter_r += " AND r.nav_date >= :sd"
        date_filter_k += " AND k.nav_date >= :sd"
        params["sd"] = start_date
    if end_date:
        date_filter_r += " AND r.nav_date <= :ed"
        date_filter_k += " AND k.nav_date <= :ed"
        params["ed"] = end_date

    cat_filter = ""
    if category:
        cat_filter = " AND s.scheme_category = :cat"
        params["cat"] = category

    sql = f"""
        SELECT
            s.scheme_code, s.scheme_name, s.fund_house, s.scheme_category, s.scheme_type,
            MIN(r.return_1y) AS min_return_1y, MAX(r.return_1y) AS max_return_1y, AVG(r.return_1y) AS avg_return_1y,
            MIN(r.return_3y) AS min_return_3y, MAX(r.return_3y) AS max_return_3y, AVG(r.return_3y) AS avg_return_3y,
            MIN(r.return_5y) AS min_return_5y, MAX(r.return_5y) AS max_return_5y, AVG(r.return_5y) AS avg_return_5y,
            MIN(k.sd_1y)     AS min_sd_1y,     MAX(k.sd_1y)     AS max_sd_1y,     AVG(k.sd_1y)     AS avg_sd_1y,
            MIN(k.sd_3y)     AS min_sd_3y,     MAX(k.sd_3y)     AS max_sd_3y,     AVG(k.sd_3y)     AS avg_sd_3y,
            MIN(k.sd_5y)     AS min_sd_5y,     MAX(k.sd_5y)     AS max_sd_5y,     AVG(k.sd_5y)     AS avg_sd_5y
        FROM scheme_details s
        LEFT JOIN rolling_return_details r
            ON s.scheme_code = r.scheme_code {date_filter_r}
        LEFT JOIN rolling_risk_details k
            ON s.scheme_code = k.scheme_code {date_filter_k}
        WHERE 1=1 {cat_filter}
        GROUP BY s.scheme_code, s.scheme_name, s.fund_house, s.scheme_category, s.scheme_type
        ORDER BY s.scheme_name
    """
    rows = db.execute(text(sql), params).fetchall()
    cols = [
        "scheme_code", "scheme_name", "fund_house", "scheme_category", "scheme_type",
        "min_return_1y", "max_return_1y", "avg_return_1y",
        "min_return_3y", "max_return_3y", "avg_return_3y",
        "min_return_5y", "max_return_5y", "avg_return_5y",
        "min_sd_1y", "max_sd_1y", "avg_sd_1y",
        "min_sd_3y", "max_sd_3y", "avg_sd_3y",
        "min_sd_5y", "max_sd_5y", "avg_sd_5y",
    ]
    return [dict(zip(cols, (_f(v) if i >= 5 else v for i, v in enumerate(r)))) for r in rows]


def _summary(db, table: str, cols: list[str], scheme_code: str, start_date, end_date):
    params: dict = {"sc": scheme_code}
    date_clause = ""
    if start_date:
        date_clause += " AND nav_date >= :sd"
        params["sd"] = start_date
    if end_date:
        date_clause += " AND nav_date <= :ed"
        params["ed"] = end_date

    selects = ", ".join(
        f"MIN({c}) AS min_{c}, MAX({c}) AS max_{c}, AVG({c}) AS avg_{c}"
        for c in cols
    )
    sql = f"SELECT {selects} FROM {table} WHERE scheme_code = :sc {date_clause}"
    row = db.execute(text(sql), params).fetchone()
    result = {}
    for c in cols:
        result[f"min_{c}"] = _f(row[f"min_{c}"])
        result[f"max_{c}"] = _f(row[f"max_{c}"])
        result[f"avg_{c}"] = _f(row[f"avg_{c}"])
    return result


def _f(v):
    return float(v) if v is not None else None
