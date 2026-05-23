from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy import text
from database import ensure_database_exists, engine
from config import DB_HOSTNAME, DB_NAME


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Startup] MFSelect API starting...")
    ensure_database_exists()
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("[Startup] Database connectivity verified.")
    yield
    print("[Shutdown] MFSelect API stopped.")


app = FastAPI(title="MFSelect API", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "host": DB_HOSTNAME, "database": DB_NAME}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
