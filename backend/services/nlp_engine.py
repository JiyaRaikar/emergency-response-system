"""
Rule-based intent classifier and entity extractor.
Built-ins only (re). No external NLP libraries or downloads.
"""

import re
from typing import Any

# 20 regex patterns per intent (matched with re.search against lowercased text)
INTENT_PATTERNS: dict[str, list[str]] = {
    "dispatch_resource": [
        r"\bsend\b.*\bambulance\b.*\bzone\s*\d+\b",
        r"\bdispatch\b.*\bfire\s*truck\b.*\b(north|south|east|west|central)\b",
        r"\bsend\b.*\b(ambulance|helicopter|fire\s*truck|rescue\s*boat|rescue\s*team|supply\s*van)\b",
        r"\bdispatch\b.*\b(ambulance|helicopter|fire\s*truck|rescue\s*boat|rescue\s*team|supply\s*van)\b",
        r"\bdeploy\b.*\b(ambulance|helicopter|fire\s*truck|rescue\s*boat|supply\s*van)\b",
        r"\bassign\b.*\b(ambulance|fire\s*truck|rescue\s*boat)\b",
        r"\broute\b.*\b(ambulance|helicopter)\b",
        r"\bmobilize\b.*\b(fire\s*truck|supply\s*van)\b",
        r"\bredirect\b.*\brescue\s*(boat|team)\b",
        r"\bmove\b.*\bfire\s*truck\b.*\bzone\b",
        r"\bstation\b.*\b(fire\s*truck|supply\s*van)\b",
        r"\bambulance\b.*\bto\b.*\bzone\b",
        r"\bfire\s*truck\b.*\bto\b.*\bzone\b",
        r"\brescue\s*(boat|team)\b.*\bto\b.*\bzone\b",
        r"\bhelicopter\b.*\bto\b.*\bzone\b",
        r"\bneed\b.*\bambulance\b.*\b(at|in|to)\b",
        r"\brequest\b.*\b(ambulance|fire\s*truck|helicopter)\b.*\bdispatch\b",
        r"\bdispatch\b.*\bunit\b.*\bzone\b",
        r"\bdeploy\b.*\bresource\b.*\bzone\b",
        r"\bassign\b.*\b(supply\s*van|helicopter)\b.*\bzone\b",
    ],
    "fetch_incidents": [
        r"\bshow\b.*\ball\b.*\bactive\b.*\bincidents\b",
        r"\blist\b.*\bactive\b.*\bincidents\b",
        r"\bfetch\b.*\bincidents\b",
        r"\bget\b.*\bactive\b.*\bincidents\b",
        r"\bdisplay\b.*\bopen\b.*\bincidents\b",
        r"\bview\b.*\b(all\s+)?incidents\b",
        r"\bshow\b.*\bincidents\b",
        r"\blist\b.*\bincidents\b",
        r"\bcurrent\b.*\bincidents\b",
        r"\bopen\b.*\bincidents\b",
        r"\bactive\b.*\bincident\b",
        r"\bwhat\b.*\bincidents\b.*\b(open|active)\b",
        r"\bincidents\b.*\bin\b.*\bzone\b",
        r"\bshow\b.*\bopen\b.*\bemergencies\b",
        r"\bget\b.*\bincident\b.*\breport\b",
        r"\blist\b.*\bongoing\b.*\bincidents\b",
        r"\bactive\b.*\bemergency\b.*\blist\b",
        r"\bshow\b.*\bemergency\b.*\blist\b",
        r"\bretrieve\b.*\bincidents\b",
        r"\ball\b.*\bactive\b.*\bincidents\b",
    ],
    "allocate_shelter": [
        r"\ballocate\b.*\bshelter\b",
        r"\bassign\b.*\bshelter\b",
        r"\breserve\b.*\bshelter\b",
        r"\bopen\b.*\bshelter\b.*\bzone\b",
        r"\bshelter\b.*\ballocation\b",
        r"\bevacuees\b.*\bto\b.*\bshelter\b",
        r"\bneed\b.*\bshelter\b.*\bin\b",
        r"\bshelter\b.*\bspace\b.*\bzone\b",
        r"\bcapacity\b.*\bshelter\b",
        r"\bbook\b.*\bshelter\b",
        r"\bset\s+up\b.*\bshelter\b",
        r"\bshelter\b.*\bfor\b.*\bzone\b",
        r"\bhousing\b.*\bshelter\b",
        r"\bplace\b.*\bevacuees\b.*\bshelter\b",
        r"\bshelter\b.*\bassignment\b",
        r"\bregister\b.*\bshelter\b",
        r"\bshelter\b.*\bbeds\b",
        r"\bevacuation\b.*\bshelter\b",
        r"\ballocate\b.*\bevacuation\b.*\b(center|centre)\b",
        r"\bshelter\b.*\bin\b.*\bzone\s*\d+\b",
    ],
    "medical_request": [
        r"\bmedical\b.*\brequest\b",
        r"\bneed\b.*\bmedical\b",
        r"\bmedical\b.*\bemergency\b",
        r"\brequest\b.*\bmedics\b",
        r"\bparamedic\b.*\bneeded\b",
        r"\bhospital\b.*\bbed\b.*\bneeded\b",
        r"\bmedevac\b",
        r"\bpatient\b.*\btransport\b",
        r"\burgent\b.*\bmedical\b",
        r"\bmedical\b.*\bassistance\b",
        r"\bsend\b.*\bdoctors\b",
        r"\bicu\b.*\bneeded\b",
        r"\btrauma\b.*\bteam\b",
        r"\bmedical\b.*\aid\b.*\bzone\b",
        r"\bhealth\b.*\bemergency\b",
        r"\bcritical\b.*\bpatient\b",
        r"\binjured\b.*\bhospital\b",
        r"\bmedical\b.*\bsupport\b",
        r"\bhealthcare\b.*\brequest\b",
        r"\bemergency\b.*\bmedical\b.*\bzone\b",
    ],
    "create_incident": [
        r"\bwildfire\b.*\b(spreading|near)\b",
        r"\b(spreading|near)\b.*\bwildfire\b",
        r"\breport\b.*\b(fire|flood|wildfire|earthquake|chemical)\b",
        r"\bnew\b.*\bincident\b",
        r"\bcreate\b.*\bincident\b",
        r"\blog\b.*\bincident\b",
        r"\bseverity\b.*\b(critical|moderate|low)\b",
        r"\b(fire|flood|wildfire)\b.*\b(zone|near)\b",
        r"\bearthquake\b.*\bnear\b",
        r"\bchemical\b.*\b(spill|leak|incident)\b",
        r"\breport\b.*\bwildfire\b",
        r"\bincident\b.*\btype\b",
        r"\bemergency\b.*\breported\b",
        r"\bspreading\b.*\bnear\b.*\bzone\b",
        r"\bblaze\b.*\bzone\b",
        r"\bhazmat\b.*\bincident\b",
        r"\bregister\b.*\bemergency\b",
        r"\bactive\b.*\b(fire|wildfire)\b.*\bzone\b",
        r"\bbreaking\b.*\bflood\b",
        r"\b(fire|wildfire|flood|earthquake|chemical)\b.*\bseverity\b",
    ],
    "get_status": [
        r"\bget\b.*\bstatus\b",
        r"\bstatus\b.*\bupdate\b",
        r"\bwhat\b.*\b(the\s+)?status\b",
        r"\bincident\b.*\bstatus\b",
        r"\bsituation\b.*\breport\b",
        r"\bcurrent\b.*\bstatus\b",
        r"\boperational\b.*\bstatus\b",
        r"\bstatus\b.*\bof\b.*\bincident\b",
        r"\bcheck\b.*\bstatus\b",
        r"\bgive\b.*\bstatus\b",
        r"\bfield\b.*\bstatus\b",
        r"\bdeployment\b.*\bstatus\b",
        r"\bresource\b.*\bstatus\b",
        r"\bsystem\b.*\bstatus\b",
        r"\boverall\b.*\bstatus\b",
        r"\blatest\b.*\bstatus\b",
        r"\bstatus\b.*\breport\b",
        r"\bhow\b.*\b(situation|things)\b",
        r"\bupdate\b.*\bon\b.*\bzone\b",
        r"\bprogress\b.*\breport\b",
    ],
}

INTENT_PRIORITY: list[str] = [
    "create_incident",
    "dispatch_resource",
    "medical_request",
    "allocate_shelter",
    "fetch_incidents",
    "get_status",
]

# DB resources.type values
RESOURCE_TYPES = (
    "ambulance",
    "helicopter",
    "rescue_boat",
    "fire_truck",
    "supply_van",
)

NAMED_ZONES = ("north", "south", "east", "west", "central")
INCIDENT_TYPES = (
    "wildfire",
    "earthquake",
    "chemical",
    "medical",
    "flood",
    "fire",
)
SEVERITIES = ("critical", "moderate", "low")


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def _score_intents(lower: str) -> dict[str, int]:
    scores: dict[str, int] = {}
    for intent, patterns in INTENT_PATTERNS.items():
        scores[intent] = sum(1 for pattern in patterns if re.search(pattern, lower))
    return scores


def _pick_intent(scores: dict[str, int]) -> str:
    best = max(scores.values())
    if best == 0:
        return "unknown"
    candidates = [intent for intent, score in scores.items() if score == best]
    if len(candidates) == 1:
        return candidates[0]
    for intent in INTENT_PRIORITY:
        if intent in candidates:
            return intent
    return candidates[0]


def _compute_confidence(
    intent: str,
    scores: dict[str, int],
    entities: dict[str, str | None],
) -> float:
    if intent == "unknown":
        return 0.0

    top = scores[intent]
    sorted_scores = sorted(scores.values(), reverse=True)
    second = sorted_scores[1] if len(sorted_scores) > 1 else 0

    pattern_ratio = top / 20.0
    margin = (top - second) / top if top else 0.0
    confidence = 0.45 * pattern_ratio + 0.35 * margin + 0.20

    entity_keys = {
        "dispatch_resource": ("resource_type", "zone"),
        "fetch_incidents": ("zone",),
        "allocate_shelter": ("zone",),
        "medical_request": ("zone", "incident_type"),
        "create_incident": ("incident_type", "zone", "severity"),
        "get_status": ("zone",),
    }
    expected = entity_keys.get(intent, ())
    if expected:
        filled = sum(1 for key in expected if entities.get(key))
        confidence += 0.08 * (filled / len(expected))

    return round(min(1.0, max(0.05, confidence)), 2)


def _extract_resource_type(text: str) -> str | None:
    """Map phrases to DB resource type strings."""
    lower = text.lower()

    if re.search(r"\brescue\s*(team|boat)\b", lower) or re.search(
        r"\brescue_boat\b", lower
    ):
        return "rescue_boat"
    if re.search(r"\bfire\s*truck\b", lower) or re.search(r"\bfire_truck\b", lower):
        return "fire_truck"
    if re.search(r"\bhelicopter\b", lower):
        return "helicopter"
    if re.search(r"\bsupply\s*van\b", lower) or re.search(r"\bsupply_van\b", lower):
        return "supply_van"
    if re.search(r"\bambulance\b", lower):
        return "ambulance"

    for db_type in RESOURCE_TYPES:
        if re.search(rf"\b{re.escape(db_type)}\b", lower):
            return db_type

    return None


def _extract_zone(text: str) -> str | None:
    numbered = re.search(r"\bzone\s*(\d{1,2})\b", text, re.IGNORECASE)
    if numbered:
        num = int(numbered.group(1))
        if 1 <= num <= 10:
            return f"Zone {num}"

    lower = text.lower()
    for name in NAMED_ZONES:
        if re.search(rf"\b{name}\b(?:\s+zone)?\b", lower):
            return name
        if re.search(rf"\bzone\s+{name}\b", lower):
            return name

    return None


def _extract_severity(text: str) -> str | None:
    lower = text.lower()
    for level in SEVERITIES:
        if re.search(rf"\b{level}\b", lower):
            return level
    return None


def _extract_incident_type(text: str) -> str | None:
    lower = text.lower()
    scrubbed = re.sub(r"\bfire\s*truck\b", " ", lower)
    for itype in INCIDENT_TYPES:
        if re.search(rf"\b{re.escape(itype)}\b", scrubbed):
            return itype
    return None


def _extract_entities(text: str) -> dict[str, str | None]:
    return {
        "resource_type": _extract_resource_type(text),
        "zone": _extract_zone(text),
        "severity": _extract_severity(text),
        "incident_type": _extract_incident_type(text),
    }


def classify(text: str) -> dict[str, Any]:
    """
    Classify command text into intent + entities + confidence.

    Returns:
        {"intent": str, "entities": dict, "confidence": float}
    """
    normalized = _normalize_text(text)
    lower = normalized.lower()
    scores = _score_intents(lower)
    intent = _pick_intent(scores)
    entities = _extract_entities(normalized)
    confidence = _compute_confidence(intent, scores, entities)

    return {
        "intent": intent,
        "entities": entities,
        "confidence": confidence,
    }


def parse_command(text: str) -> dict[str, Any]:
    """Alias for classify(); used by the command API."""
    return classify(text)
