from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Alert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class AlertCreate(BaseModel):
    type: str
    message: str
    severity: str
    auto_generated: bool = False


class AlertResponse(BaseModel):
    id: int
    type: str
    message: str
    severity: str
    auto_generated: bool
    created_at: datetime | None

    model_config = {"from_attributes": True}


def _alert_event(alert: Alert) -> dict:
    return {
        "event": "alert",
        "id": alert.id,
        "type": alert.type,
        "message": alert.message,
        "severity": alert.severity,
        "auto_generated": alert.auto_generated,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
    }


@router.get("", response_model=list[AlertResponse])
def list_alerts(
    severity: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Alert).order_by(Alert.created_at.desc())
    if severity:
        query = query.filter(Alert.severity == severity)
    return query.limit(limit).all()


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.post("", response_model=AlertResponse, status_code=201)
def create_alert(
    payload: AlertCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    alert = Alert(**payload.model_dump())
    db.add(alert)
    db.commit()
    db.refresh(alert)

    broadcast = getattr(request.app.state, "broadcast", None)
    if broadcast:
        broadcast(_alert_event(alert))

    return alert
