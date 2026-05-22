from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import INCIDENT_STATUSES, Incident

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


class IncidentCreate(BaseModel):
    type: str
    severity: str
    location_zone: str
    status: str = "open"


class IncidentUpdate(BaseModel):
    type: str | None = None
    severity: str | None = None
    location_zone: str | None = None
    status: str | None = None


class IncidentResponse(BaseModel):
    id: int
    type: str
    severity: str
    location_zone: str
    status: str
    created_at: datetime | None
    updated_at: datetime | None

    model_config = {"from_attributes": True}


def _serialize(incident: Incident) -> dict[str, Any]:
    return IncidentResponse.model_validate(incident).model_dump(mode="json")


@router.get("", response_model=list[IncidentResponse])
def list_incidents(
    status: str | None = None,
    zone: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Incident).order_by(Incident.created_at.desc())
    if status:
        if status not in INCIDENT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid incident status",
                    "valid_values": list(INCIDENT_STATUSES),
                },
            )
        query = query.filter(Incident.status == status)
    if zone:
        query = query.filter(Incident.location_zone.ilike(f"%{zone}%"))
    return query.all()


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.post("", response_model=IncidentResponse, status_code=201)
def create_incident(
    payload: IncidentCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    incident = Incident(**payload.model_dump())
    db.add(incident)
    db.commit()
    db.refresh(incident)
    broadcast = getattr(request.app.state, "broadcast", None)
    if broadcast:
        broadcast(
            {
                "event": "incident",
                "action": "created",
                "data": _serialize(incident),
            }
        )
    return incident


@router.patch("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: int,
    payload: IncidentUpdate,
    db: Session = Depends(get_db),
):
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(incident, key, value)
    db.commit()
    db.refresh(incident)
    return incident


@router.delete("/{incident_id}", status_code=204)
def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    db.delete(incident)
    db.commit()
