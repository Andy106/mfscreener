from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import bcrypt

from database import ensure_database_exists, engine, SessionLocal, Base
from config import DB_HOSTNAME, DB_NAME
import models  # registers all models with Base
from routers import auth


def seed_admin():
    db = SessionLocal()
    try:
        from models import User
        if not db.query(User).filter(User.username == "admin").first():
            hashed = bcrypt.hashpw(b"password", bcrypt.gensalt()).decode()
            db.add(User(username="admin", password_hash=hashed))
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
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("[Startup] Database connectivity verified.")
    yield
    print("[Shutdown] MFSelect API stopped.")


app = FastAPI(title="MFSelect API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/health")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "host": DB_HOSTNAME, "database": DB_NAME}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
