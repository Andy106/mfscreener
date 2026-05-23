import re
import httpx
from datetime import date
from sqlalchemy.orm import Session

from models import SchemeDetail, AmfiReloadTracker

AMFI_URL = "https://portal.amfiindia.com/spages/NAVAll.txt"

TARGET_CATEGORIES = {
    "Equity Scheme - Flexi Cap Fund",
    "Equity Scheme - Large Cap Fund",
    "Equity Scheme - Multi Cap Fund",
}


def parse_amfi_data(text: str) -> list[dict]:
    """Stream through NAV All text, tracking headers to extract scheme metadata."""
    records = []
    current_scheme_type = None
    current_scheme_category = None
    current_fund_house = None

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        # Scheme type/category header e.g. "Open Ended Schemes(Equity Scheme - Flexi Cap Fund)"
        m = re.match(r'^(.+?)\s+Schemes?\((.+)\)\s*$', line)
        if m:
            current_scheme_type = m.group(1).strip()
            current_scheme_category = m.group(2).strip()
            current_fund_house = None
            continue

        # Column header row — skip
        if line.startswith(';'):
            continue

        # Data row: scheme_code;isin1;isin2;scheme_name;nav;date
        if line[0].isdigit() and ';' in line:
            if current_scheme_category not in TARGET_CATEGORIES:
                continue
            parts = line.split(';')
            if len(parts) < 4:
                continue
            scheme_code = parts[0].strip()
            scheme_name = parts[3].strip()
            if 'discontinued' in scheme_name.lower():
                continue
            records.append({
                'scheme_code': scheme_code,
                'scheme_name': scheme_name,
                'fund_house': current_fund_house or '',
                'scheme_type': current_scheme_type or '',
                'scheme_category': current_scheme_category or '',
            })
            continue

        # Any other non-empty line after a scheme type header = fund house name
        if current_scheme_type is not None:
            current_fund_house = line

    return records


def check_and_reload_amfi(db: Session):
    tracker = db.query(AmfiReloadTracker).first()
    if tracker and tracker.last_data_reload >= date.today():
        print(f"[AMFI] Scheme data is current (last reload: {tracker.last_data_reload})")
        return

    print("[AMFI] Fetching scheme data from AMFI...")
    with httpx.Client(timeout=60) as client:
        resp = client.get(AMFI_URL)
        resp.raise_for_status()

    records = parse_amfi_data(resp.text)
    print(f"[AMFI] Parsed {len(records)} schemes after filtering")

    db.query(SchemeDetail).delete()
    for rec in records:
        db.add(SchemeDetail(**rec))

    if tracker:
        tracker.last_data_reload = date.today()
    else:
        db.add(AmfiReloadTracker(last_data_reload=date.today()))

    db.commit()
    print(f"[AMFI] Reload complete — {len(records)} schemes stored.")
