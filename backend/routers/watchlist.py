from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from models import WatchlistDetail, SchemeDetail

router = APIRouter()


@router.get("/watchlist")
def get_watchlist(db: Session = Depends(get_db)):
    rows = (
        db.query(SchemeDetail)
        .join(WatchlistDetail, SchemeDetail.scheme_code == WatchlistDetail.scheme_code)
        .order_by(SchemeDetail.scheme_name)
        .all()
    )
    return [
        {
            "scheme_code": r.scheme_code,
            "scheme_name": r.scheme_name,
            "fund_house": r.fund_house,
            "scheme_category": r.scheme_category,
            "scheme_type": r.scheme_type,
        }
        for r in rows
    ]


@router.post("/watchlist/{scheme_code}", status_code=201)
def add_to_watchlist(scheme_code: str, db: Session = Depends(get_db)):
    if not db.query(SchemeDetail).filter(SchemeDetail.scheme_code == scheme_code).first():
        raise HTTPException(status_code=404, detail="Scheme not found")
    if db.query(WatchlistDetail).filter(WatchlistDetail.scheme_code == scheme_code).first():
        return {"message": "Already in watchlist"}
    db.add(WatchlistDetail(scheme_code=scheme_code))
    db.commit()
    return {"message": "Added to watchlist"}


@router.delete("/watchlist/{scheme_code}", status_code=200)
def remove_from_watchlist(scheme_code: str, db: Session = Depends(get_db)):
    item = db.query(WatchlistDetail).filter(WatchlistDetail.scheme_code == scheme_code).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not in watchlist")
    db.delete(item)
    db.commit()
    return {"message": "Removed from watchlist"}
