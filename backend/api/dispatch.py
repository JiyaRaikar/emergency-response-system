from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import DispatchLog, Incident, Resource

router = APIRouter(prefix="/api/dispatch", tags=["dispatch"])


class DispatchCreate(BaseModel):
    incident_id: int
    resource_id: int
    operator_id: int | None = None
    action: str = "dispatch"
    status: str = "en_route"


class DispatchUpdate(BaseModel):
    status: str | None = None
    action: str | None = None


class DispatchResponse(BaseModel):
    id: int
    incident_id: int
    resource_id: int
    operator_id: int | None
    action: str
    timestamp: datetime | None
    status: str

    model_config = {"from_attributes": True}


def _dispatch_event(log: DispatchLog, incident: Incident, resource: Resource) -> dict:
    return {
        "event": "dispatch",
        "id": log.id,
        "incident_id": log.incident_id,
        "resource_id": log.resource_id,
        "operator_id": log.operator_id,
        "action": log.action,
        "status": log.status,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "incident_type": incident.type,
        "resource_type": resource.type,
    }


@router.get("", response_model=list[DispatchResponse])
def list_dispatches(
    incident_id: int | None = None,
    resource_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(DispatchLog).order_by(DispatchLog.timestamp.desc())
    if incident_id:
        query = query.filter(DispatchLog.incident_id == incident_id)
    if resource_id:
        query = query.filter(DispatchLog.resource_id == resource_id)
    return query.all()


@router.get("/{dispatch_id}", response_model=DispatchResponse)
def get_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    log = db.get(DispatchLog, dispatch_id)
    if not log:
        raise HTTPException(status_code=404, detail="Dispatch log not found")
    return log


@router.post("", response_model=DispatchResponse, status_code=201)
def create_dispatch(
    payload: DispatchCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    incident = db.get(Incident, payload.incident_id)
    resource = db.get(Resource, payload.resource_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    resource.status = "dispatched"
    log = DispatchLog(**payload.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    db.refresh(resource)

    broadcast = getattr(request.app.state, "broadcast", None)
    if broadcast:
        broadcast(_dispatch_event(log, incident, resource))

    return log


@router.patch("/{dispatch_id}", response_model=DispatchResponse)
def update_dispatch(
    dispatch_id: int,
    payload: DispatchUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    log = db.get(DispatchLog, dispatch_id)
    if not log:
        raise HTTPException(status_code=404, detail="Dispatch log not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(log, key, value)

    incident = db.get(Incident, log.incident_id)
    resource = db.get(Resource, log.resource_id)
    db.commit()
    db.refresh(log)

    broadcast = getattr(request.app.state, "broadcast", None)
    if broadcast and incident and resource:
        broadcast(_dispatch_event(log, incident, resource))

    return log
