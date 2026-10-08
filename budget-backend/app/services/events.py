import json

from sqlalchemy.orm import Session

from app.models import Event


def log_event(db: Session, user_id: int, name: str, **data) -> None:
    """Record a first-party product event in our own database (see Event).
    Never sent anywhere. Caller commits."""
    db.add(Event(user_id=user_id, name=name, data=json.dumps(data) if data else None))
