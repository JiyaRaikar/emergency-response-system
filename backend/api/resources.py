from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Hospital, Personnel, Resource, Shelter

router = APIRouter(prefix="/api/resources", tags=["resources"])


class ResourceCreate(BaseModel):
    type: str
    status: str = "available"
    location_zone: str
    fuel_level: float | None = None


class ResourceUpdate(BaseModel):
    type: str | None = None
    status: str | None = None
    location_zone: str | None = None
    fuel_level: float | None = None


class ResourceResponse(BaseModel):
    id: int
    type: str
    status: str
    location_zone: str
    fuel_level: float | None

    model_config = {"from_attributes": True}


class PersonnelResponse(BaseModel):
    id: int
    name: str
    role: str
    resource_id: int | None

    model_config = {"from_attributes": True}


class HospitalResponse(BaseModel):
    id: int
    name: str
    zone: str
    icu_beds: int
    total_beds: int
    current_occupancy: int

    model_config = {"from_attributes": True}


class ShelterResponse(BaseModel):
    id: int
    name: str
    zone: str
    capacity: int
    current_occupancy: int

    model_config = {"from_attributes": True}


@router.get("/personnel/all", response_model=list[PersonnelResponse])
def list_personnel(db: Session = Depends(get_db)):
    return db.query(Personnel).all()


@router.get("/hospitals/all", response_model=list[HospitalResponse])
def list_hospitals(zone: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Hospital)
    if zone:
        query = query.filter(Hospital.zone.ilike(f"%{zone}%"))
    return query.all()


@router.get("/shelters/all", response_model=list[ShelterResponse])
def list_shelters(zone: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Shelter)
    if zone:
        query = query.filter(Shelter.zone.ilike(f"%{zone}%"))
    return query.all()


@router.get("", response_model=list[ResourceResponse])
def list_resources(
    status: str | None = None,
    zone: str | None = None,
    resource_type: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Resource)
    if status:
        query = query.filter(Resource.status == status)
    if zone:
        query = query.filter(Resource.location_zone.ilike(f"%{zone}%"))
    if resource_type:
        query = query.filter(Resource.type.ilike(f"%{resource_type}%"))
    return query.all()


@router.get("/{resource_id}", response_model=ResourceResponse)
def get_resource(resource_id: int, db: Session = Depends(get_db)):
    resource = db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource


@router.post("", response_model=ResourceResponse, status_code=201)
def create_resource(payload: ResourceCreate, db: Session = Depends(get_db)):
    resource = Resource(**payload.model_dump())
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.patch("/{resource_id}", response_model=ResourceResponse)
def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    db: Session = Depends(get_db),
):
    resource = db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(resource, key, value)
    db.commit()
    db.refresh(resource)
    return resource
