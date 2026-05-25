from sqlalchemy import Column, Integer, String, Date, Numeric, Index
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)


class SchemeDetail(Base):
    __tablename__ = "scheme_details"

    scheme_code = Column(String, primary_key=True)
    fund_house = Column(String, nullable=False)
    scheme_type = Column(String, nullable=False)
    scheme_category = Column(String, nullable=False)
    scheme_name = Column(String, nullable=False)


class AmfiReloadTracker(Base):
    __tablename__ = "amfi_reload_tracker"

    id = Column(Integer, primary_key=True)
    last_data_reload = Column(Date, nullable=False)


class NavDetail(Base):
    """Composite PK (scheme_code, nav_date) serves as the unique index."""
    __tablename__ = "nav_details"

    scheme_code = Column(String, primary_key=True)
    nav_date = Column(Date, primary_key=True)
    nav_value = Column(Numeric(20, 6), nullable=False)


class MfapiReloadTracker(Base):
    __tablename__ = "mfapi_reload_tracker"

    id = Column(Integer, primary_key=True)
    last_data_reload = Column(Date, nullable=False)


class RollingReturnDetail(Base):
    __tablename__ = "rolling_return_details"

    scheme_code = Column(String, primary_key=True)
    nav_date = Column(Date, primary_key=True)
    return_1y = Column(Numeric(12, 6), nullable=True)
    return_3y = Column(Numeric(12, 6), nullable=True)
    return_5y = Column(Numeric(12, 6), nullable=True)


class RollingRiskDetail(Base):
    __tablename__ = "rolling_risk_details"

    scheme_code = Column(String, primary_key=True)
    nav_date = Column(Date, primary_key=True)
    sd_1y = Column(Numeric(12, 6), nullable=True)
    sd_3y = Column(Numeric(12, 6), nullable=True)
    sd_5y = Column(Numeric(12, 6), nullable=True)


class MetricsCalculationTracker(Base):
    __tablename__ = "metrics_calculation_tracker"

    scheme_code = Column(String, primary_key=True)
    latest_nav_date_factored = Column(Date, nullable=False)


class WatchlistDetail(Base):
    __tablename__ = "watchlist_details"

    scheme_code = Column(String, primary_key=True)
