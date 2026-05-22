import re
from datetime import datetime, timezone
from typing import Any, Callable

from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models import (
    Alert,
    DispatchLog,
    Incident,
    OPEN_INCIDENT_STATUSES,
    RESOURCE_TYPES,
    Resource,
)

# Map directional zones to numeric positions for distance comparison (Zone 1–10 scale)
NAMED_ZONE_VALUES: dict[str, int] = {
    "north": 2,
    "south": 8,
    "east": 6,
    "west": 4,
    "central": 5,
}

RESOURCE_PREFIX: dict[str, str] = {
    "ambulance": "AMB",
    "helicopter": "HELI",
    "rescue_boat": "BOAT",
    "fire_truck": "FIRE",
    "supply_van": "VAN",
}

DISPATCH_LOG_ACTION = "dispatched via NLP command"
DISPATCH_LOG_STATUS = "completed"
DEFAULT_OPERATOR_ID = 1
DEFAULT_INCIDENT_ID = 1

class DecisionEngine:
    """Execute database actions from NLP intent and extracted entities."""

    def __init__(
        self,
        db: Session,
        on_dispatch: Callable[[dict[str, Any]], None] | None = None,
        on_alert: Callable[[dict[str, Any]], None] | None = None,
    ):
        self.db = db
        self.on_dispatch = on_dispatch
        self.on_alert = on_alert

    def execute(self, parsed: dict[str, Any]) -> dict[str, Any]:
        intent = parsed.get("intent", "unknown")
        entities = parsed.get("entities") or {}
        raw_text = parsed.get("raw_text", "")

        handlers = {
            "dispatch_resource": self._dispatch_resource,
            "create_incident": self._create_incident,
            "fetch_incidents": self._fetch_incidents,
            "get_status": self._get_status,
        }

        handler = handlers.get(intent)
        if not handler:
            return {
                "action_taken": "none",
                "result": None,
                "explanation": (
                    f"No handler for intent '{intent}'. "
                    "Supported: dispatch_resource, create_incident, "
                    "fetch_incidents, get_status."
                ),
            }

        return handler(entities, raw_text)

    def _dispatch_resource(
        self, entities: dict[str, Any], raw_text: str
    ) -> dict[str, Any]:
        try:
            return self._dispatch_resource_impl(entities, raw_text)
        except Exception as exc:
            self.db.rollback()
            return {
                "action_taken": "dispatch_resource",
                "result": None,
                "explanation": f"Dispatch failed: {exc}",
            }

    def _dispatch_resource_impl(
        self, entities: dict[str, Any], raw_text: str
    ) -> dict[str, Any]:
        resource_type = None
        target_zone = None
        if entities:
            raw_type = entities.get("resource_type")
            if raw_type is not None and str(raw_type).strip():
                resource_type = normalize_resource_type(str(raw_type))
            raw_zone = entities.get("zone")
            if raw_zone is not None and str(raw_zone).strip():
                target_zone = str(raw_zone).strip()

        resource = fetch_available_resource(self.db, resource_type)
        if not resource:
            if resource_type:
                return {
                    "action_taken": "dispatch_resource",
                    "result": None,
                    "explanation": "No available resources of that type found",
                }
            return {
                "action_taken": "dispatch_resource",
                "result": None,
                "explanation": "No available resources found",
            }

        incident_id = DEFAULT_INCIDENT_ID
        incident = None
        if target_zone:
            incident = self._resolve_incident_for_dispatch(target_zone)
        if not incident:
            incident = self._resolve_incident_for_dispatch_any()
        if incident:
            incident_id = incident.id
        if not target_zone and incident:
            target_zone = incident.location_zone
        if not target_zone:
            target_zone = resource.location_zone

        resource.status = "dispatched"
        log = DispatchLog(
            incident_id=incident_id,
            resource_id=resource.id,
            operator_id=DEFAULT_OPERATOR_ID,
            action=DISPATCH_LOG_ACTION,
            status=DISPATCH_LOG_STATUS,
            timestamp=datetime.now(timezone.utc),
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(resource)
        self.db.refresh(log)

        payload = dispatch_payload(log, incident, resource, target_zone)
        if self.on_dispatch:
            self.on_dispatch(payload)

        type_name = _resource_display_name(resource.type)
        explanation = (
            f"{type_name} {resource_label(resource)} selected: available, "
            f"dispatched to {target_zone}"
        )

        return {
            "action_taken": "dispatch_resource",
            "result": payload,
            "explanation": explanation,
        }

    def _create_incident(
        self, entities: dict[str, Any], raw_text: str
    ) -> dict[str, Any]:
        incident_type = entities.get("incident_type") or "general"
        severity = entities.get("severity") or "moderate"
        zone = entities.get("zone") or "unknown"

        incident = Incident(
            type=incident_type,
            severity=severity,
            location_zone=zone,
            status="open",
        )
        self.db.add(incident)
        self.db.flush()

        alert = Alert(
            type="incident",
            message=f"New {incident_type} incident ({severity}) in {zone}",
            severity=severity,
            auto_generated=True,
        )
        self.db.add(alert)
        self.db.commit()
        self.db.refresh(incident)
        self.db.refresh(alert)

        alert_payload = alert_to_dict(alert)
        if self.on_alert:
            self.on_alert(alert_payload)

        return {
            "action_taken": "create_incident",
            "result": {
                "incident": incident_to_dict(incident),
                "alert": alert_payload,
            },
            "explanation": (
                f"Created incident #{incident.id} ({incident_type}, {severity}) "
                f"in {zone} and auto-generated alert #{alert.id}."
            ),
        }

    def _fetch_incidents(
        self, entities: dict[str, Any], raw_text: str
    ) -> dict[str, Any]:
        query = self.db.query(Incident)

        lower = raw_text.lower()
        if any(
            word in lower
            for word in ("active", "open", "ongoing", "current")
        ):
            query = query.filter(Incident.status.in_(OPEN_INCIDENT_STATUSES))

        if entities.get("zone"):
            query = query.filter(
                Incident.location_zone.ilike(f"%{entities['zone']}%")
            )
        if entities.get("incident_type"):
            query = query.filter(
                Incident.type.ilike(f"%{entities['incident_type']}%")
            )
        if entities.get("severity"):
            query = query.filter(Incident.severity == entities["severity"])

        incidents = query.order_by(Incident.created_at.desc()).limit(50).all()
        data = [incident_to_dict(i) for i in incidents]

        filters = []
        if entities.get("zone"):
            filters.append(f"zone={entities['zone']}")
        if entities.get("incident_type"):
            filters.append(f"type={entities['incident_type']}")
        if entities.get("severity"):
            filters.append(f"severity={entities['severity']}")
        if any(
            word in lower
            for word in ("active", "open", "ongoing", "current")
        ):
            filters.append(f"status in {list(OPEN_INCIDENT_STATUSES)}")

        filter_text = ", ".join(filters) if filters else "no filters"
        return {
            "action_taken": "fetch_incidents",
            "result": {"incidents": data, "count": len(data)},
            "explanation": f"Returned {len(data)} incident(s) ({filter_text}).",
        }

    def _get_status(self, entities: dict[str, Any], raw_text: str) -> dict[str, Any]:
        incident_rows = (
            self.db.query(Incident.status, func.count(Incident.id))
            .group_by(Incident.status)
            .all()
        )
        resource_rows = (
            self.db.query(Resource.status, func.count(Resource.id))
            .group_by(Resource.status)
            .all()
        )

        incidents_by_status = {status: count for status, count in incident_rows}
        resources_by_status = {status: count for status, count in resource_rows}

        total_incidents = sum(incidents_by_status.values())
        total_resources = sum(resources_by_status.values())

        zone = entities.get("zone")
        zone_incidents = None
        zone_resources = None
        if zone:
            zone_incidents = (
                self.db.query(Incident)
                .filter(Incident.location_zone.ilike(f"%{zone}%"))
                .count()
            )
            zone_resources = (
                self.db.query(Resource)
                .filter(Resource.location_zone.ilike(f"%{zone}%"))
                .count()
            )

        result = {
            "incidents": {
                "total": total_incidents,
                "by_status": incidents_by_status,
                "unresolved": sum(
                    incidents_by_status.get(s, 0) for s in OPEN_INCIDENT_STATUSES
                ),
            },
            "resources": {
                "total": total_resources,
                "by_status": resources_by_status,
                "available": resources_by_status.get("available", 0),
                "dispatched": resources_by_status.get("dispatched", 0),
            },
        }
        if zone:
            result["zone_filter"] = {
                "zone": zone,
                "incidents": zone_incidents,
                "resources": zone_resources,
            }

        explanation = (
            f"System status: {total_incidents} incident(s) "
            f"({result['incidents']['unresolved']} open/in_progress/assigned), "
            f"{total_resources} resource(s) "
            f"({result['resources']['available']} available, "
            f"{result['resources']['dispatched']} dispatched)."
        )
        if zone:
            explanation += (
                f" In {zone}: {zone_incidents} incident(s), "
                f"{zone_resources} resource(s)."
            )

        return {
            "action_taken": "get_status",
            "result": result,
            "explanation": explanation,
        }

    def _resolve_incident_for_dispatch_any(self) -> Incident | None:
        return (
            self.db.query(Incident)
            .filter(Incident.status.in_(OPEN_INCIDENT_STATUSES))
            .order_by(Incident.created_at.desc())
            .first()
        )

    def _resolve_incident_for_dispatch(self, target_zone: str) -> Incident | None:
        incident = (
            self.db.query(Incident)
            .filter(
                Incident.status.in_(OPEN_INCIDENT_STATUSES),
                Incident.location_zone.ilike(f"%{target_zone}%"),
            )
            .order_by(Incident.created_at.desc())
            .first()
        )
        if incident:
            return incident

        return (
            self.db.query(Incident)
            .filter(Incident.status.in_(OPEN_INCIDENT_STATUSES))
            .order_by(Incident.created_at.desc())
            .first()
        )


def normalize_resource_type(value: str) -> str:
    """Map NLP aliases to exact DB resource type strings."""
    lower = value.lower().replace(" ", "_").strip()
    if lower in RESOURCE_TYPES:
        return lower
    if "rescue" in lower and ("team" in lower or "boat" in lower):
        return "rescue_boat"
    if "fire" in lower and "truck" in lower:
        return "fire_truck"
    if "supply" in lower and "van" in lower:
        return "supply_van"
    if "helicopter" in lower:
        return "helicopter"
    if "ambulance" in lower:
        return "ambulance"
    return lower


def fetch_available_resource(
    db: Session, resource_type: str | None
) -> Resource | None:
    """
    status='available' AND type=<resource_type> when type is known;
    otherwise first available resource of any type.
    """
    query = db.query(Resource).filter(Resource.status == "available")
    if resource_type:
        return query.filter(Resource.type == resource_type).first()
    return query.first()


def zone_to_number(zone: str | None) -> int | None:
    if not zone:
        return None
    match = re.search(r"zone\s*(\d{1,2})\b", zone, re.IGNORECASE)
    if match:
        num = int(match.group(1))
        if 1 <= num <= 10:
            return num
    key = zone.strip().lower()
    if key in NAMED_ZONE_VALUES:
        return NAMED_ZONE_VALUES[key]
    if key.endswith(" zone"):
        return NAMED_ZONE_VALUES.get(key[:-5].strip())
    return None


def resource_label(resource: Resource) -> str:
    prefix = RESOURCE_PREFIX.get(resource.type, "UNIT")
    return f"{prefix}-{resource.id:02d}"


def _resource_display_name(resource_type: str) -> str:
    names = {
        "ambulance": "Ambulance",
        "helicopter": "Helicopter",
        "rescue_boat": "Rescue boat",
        "fire_truck": "Fire truck",
        "supply_van": "Supply van",
    }
    return names.get(resource_type, resource_type.replace("_", " ").title())


def incident_to_dict(incident: Incident) -> dict[str, Any]:
    return {
        "id": incident.id,
        "type": incident.type,
        "severity": incident.severity,
        "location_zone": incident.location_zone,
        "status": incident.status,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
        "updated_at": incident.updated_at.isoformat() if incident.updated_at else None,
    }


def alert_to_dict(alert: Alert) -> dict[str, Any]:
    return {
        "event": "alert",
        "id": alert.id,
        "type": alert.type,
        "message": alert.message,
        "severity": alert.severity,
        "auto_generated": alert.auto_generated,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
    }


def dispatch_payload(
    log: DispatchLog,
    incident: Incident | None,
    resource: Resource,
    target_zone: str,
) -> dict[str, Any]:
    return {
        "event": "dispatch",
        "id": log.id,
        "incident_id": log.incident_id,
        "resource_id": log.resource_id,
        "operator_id": log.operator_id,
        "action": log.action,
        "status": log.status,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "resource_label": resource_label(resource),
        "resource_type": resource.type,
        "from_zone": resource.location_zone,
        "incident_type": incident.type if incident else None,
        "target_zone": target_zone,
    }
