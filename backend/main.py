from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import bcrypt

from database import ensure_database_exists, engine, SessionLocal, Base
from config import DB_HOSTNAME, DB_NAME
import models  # registers all models with Base
from routers import auth, schemes, metrics
from services.amfi import check_and_reload_amfi
from services.nav import check_and_load_nav
from services.metrics import check_and_calculate_metrics


def seed_admin():
    db = SessionLocal()
    try:
        if not db.query(models.User).filter(models.User.username == "admin").first():
            hashed = bcrypt.hashpw(b"password", bcrypt.gensalt()).decode()
            db.add(models.User(username="admin", password_hash=hashed))
            db.commit()
            print("[DB] Admin user seeded")
        else:
            print("[DB] Admin user already exists")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Startup] MFSelect API starting...")
    ensure_database_exists()
    Base.metadata.create_all(bind=engine)
    seed_admin()

    db = SessionLocal()
    try:
        check_and_reload_amfi(db)
        await check_and_load_nav(db)
        check_and_calculate_metrics(db)
    finally:
        db.close()

    print("[Startup] Startup complete — API ready.")
    yield
    print("[Shutdown] MFSelect API stopped.")


app = FastAPI(title="MFSelect API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(schemes.router)
app.include_router(metrics.router)


@app.get("/health")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "host": DB_HOSTNAME, "database": DB_NAME}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
