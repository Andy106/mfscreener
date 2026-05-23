from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import NavDetail, SchemeDetail

router = APIRouter()


@router.get("/schemes")
def get_schemes(db: Session = Depends(get_db)):
    schemes = db.query(SchemeDetail).order_by(SchemeDetail.scheme_name).all()
    return [
        {
            "scheme_code": s.scheme_code,
            "scheme_name": s.scheme_name,
            "fund_house": s.fund_house,
            "scheme_type": s.scheme_type,
            "scheme_category": s.scheme_category,
        }
        for s in schemes
    ]


@router.get("/nav/{scheme_code}")
def get_nav(
    scheme_code: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(NavDetail).filter(NavDetail.scheme_code == scheme_code)
    if start_date:
        q = q.filter(NavDetail.nav_date >= start_date)
    if end_date:
        q = q.filter(NavDetail.nav_date <= end_date)
    rows = q.order_by(NavDetail.nav_date).all()
    return [{"nav_date": str(r.nav_date), "nav_value": float(r.nav_value)} for r in rows]
