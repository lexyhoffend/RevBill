import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.database import Base, engine
from app.routers import auth, periods, plan, savings, sharing, sources

Base.metadata.create_all(bind=engine)


# Columns added to tables that already exist in deployed databases.
_COLUMN_ADDITIONS = {
    "users": {
        "terms_accepted_at": "TIMESTAMP",
        "terms_version": "VARCHAR(20)",
        "pay_cycle_anchor_day2": "INTEGER",
        "cycle_layout": "VARCHAR(10)",
        "welcome_seen_pay_date": "DATE",
    },
    "pay_periods": {
        "pay_date": "DATE",
        "plan_future_amount": "NUMERIC(10, 2)",
        "plan_future_bucket_id": "INTEGER",
        "plan_fun_amount": "NUMERIC(10, 2)",
        "managed_at": "TIMESTAMP",
    },
    "bill_entries": {
        "planned_amount": "NUMERIC(10, 2)",
        "deferred_amount": "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    },
    "income_sources": {
        "cadence_day_of_month2": "INTEGER",
    },
    "savings_buckets": {
        "per_paycheck_amount": "NUMERIC(10, 2)",
    },
}


def _add_missing_columns() -> None:
    """create_all only creates missing tables, never missing columns, and
    there's no migration tool -- so columns added to an existing table are
    added here, idempotently, on startup (plain ADD COLUMN works on both
    SQLite and Postgres). Legacy cycles get pay_date = end_date, the payday
    they were laid out around."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in _COLUMN_ADDITIONS.items():
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, sql_type in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))
        conn.execute(text("UPDATE pay_periods SET pay_date = end_date WHERE pay_date IS NULL"))


_add_missing_columns()

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
app.include_router(plan.router)


@app.get("/health")
def health():
    return {"status": "ok"}
