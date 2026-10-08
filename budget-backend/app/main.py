import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.database import Base, engine
from app.routers import auth, periods, savings, sharing, sources

Base.metadata.create_all(bind=engine)


def _add_missing_user_columns() -> None:
    """create_all only creates missing tables, never missing columns, and
    there's no migration tool -- so columns added to an existing table are
    added here, idempotently, on startup (plain nullable ADD COLUMN works on
    both SQLite and Postgres)."""
    existing = {c["name"] for c in inspect(engine).get_columns("users")}
    additions = {"terms_accepted_at": "TIMESTAMP", "terms_version": "VARCHAR(20)"}
    with engine.begin() as conn:
        for name, sql_type in additions.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {sql_type}"))


_add_missing_user_columns()

app = FastAPI(title="RevBill API")

# CORS_ORIGINS is a comma-separated list (e.g. the deployed Vercel URL) set via
# env var in production; local dev origins always stay allowed so `npm run dev`
# keeps working out of the box without needing any env var set.
_extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000", *_extra_origins],
    allow_credentials=True,  # required so the session cookie is sent/accepted cross-origin
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sources.router)
app.include_router(periods.router)
app.include_router(savings.router)
app.include_router(sharing.router)


@app.get("/health")
def health():
    return {"status": "ok"}
