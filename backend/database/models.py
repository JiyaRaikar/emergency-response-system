from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from database.connection import Base

# PostgreSQL enum values (keep in sync with DB)
INCIDENT_STATUSES = ("open", "in_progress", "assigned", "resolved")
OPEN_INCIDENT_STATUSES = ("open", "in_progress", "assigned")
RESOURCE_STATUSES = ("available", "dispatched", "maintenance")
RESOURCE_TYPES = ("ambulance", "helicopter", "rescue_boat", "fire_truck", "supply_van")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(50), nullable=False)
    location_zone: Mapped[str] = mapped_column(String(100), nullable=False)
    # Plain VARCHAR in ORM (not sqlalchemy.Enum) — values must match DB incident_status enum
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    dispatch_logs: Mapped[list["DispatchLog"]] = relationship(
        back_populates="incident"
    )


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="available")
    location_zone: Mapped[str] = mapped_column(String(100), nullable=False)
    fuel_level: Mapped[float | None] = mapped_column(Float, nullable=True)

    personnel: Mapped[list["Personnel"]] = relationship(back_populates="resource")
    dispatch_logs: Mapped[list["DispatchLog"]] = relationship(
        back_populates="resource"
    )


class Personnel(Base):
    __tablename__ = "personnel"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("resources.id"), nullable=True
    )

    resource: Mapped["Resource | None"] = relationship(back_populates="personnel")


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    zone: Mapped[str] = mapped_column(String(100), nullable=False)
    icu_beds: Mapped[int] = mapped_column(Integer, nullable=False)
    total_beds: Mapped[int] = mapped_column(Integer, nullable=False)
    current_occupancy: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Shelter(Base):
    __tablename__ = "shelters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    zone: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    current_occupancy: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class DispatchLog(Base):
    __tablename__ = "dispatch_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("incidents.id"), nullable=False
    )
    resource_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("resources.id"), nullable=False
    )
    operator_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")

    incident: Mapped["Incident"] = relationship(back_populates="dispatch_logs")
    resource: Mapped["Resource"] = relationship(back_populates="dispatch_logs")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(50), nullable=False)
    auto_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
