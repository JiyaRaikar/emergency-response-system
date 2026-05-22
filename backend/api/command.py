from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.connection import get_db
from services.decision_engine import DecisionEngine
from services.nlp_engine import parse_command

router = APIRouter(prefix="/api", tags=["command"])


class CommandRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


class CommandResponse(BaseModel):
    intent: str
    entities: dict
    confidence: float
    action_taken: str
    result: object | None
    explanation: str


@router.post("/command", response_model=CommandResponse)
def process_command(
    payload: CommandRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    parsed = parse_command(payload.text)
    broadcast = getattr(request.app.state, "broadcast", None)

    engine = DecisionEngine(
        db,
        on_dispatch=broadcast,
        on_alert=broadcast,
    )
    outcome = engine.execute({**parsed, "raw_text": payload.text})

    return CommandResponse(
        intent=parsed["intent"],
        entities=parsed["entities"],
        confidence=parsed["confidence"],
        action_taken=outcome["action_taken"],
        result=outcome["result"],
        explanation=outcome["explanation"],
    )
