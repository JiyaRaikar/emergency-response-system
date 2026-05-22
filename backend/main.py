import json
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api.alerts import router as alerts_router
from api.command import router as command_router
from api.dispatch import router as dispatch_router
from api.incidents import router as incidents_router
from api.resources import router as resources_router


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str) -> None:
        dead: list[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.disconnect(connection)


manager = ConnectionManager()


def broadcast_event(data: dict[str, Any]) -> None:
    """Schedule a WebSocket broadcast from sync route handlers."""
    import asyncio

    message = json.dumps(data, default=str)
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast(message))
    except RuntimeError:
        asyncio.run(manager.broadcast(message))


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.broadcast = broadcast_event
    yield
    app.state.broadcast = None


app = FastAPI(
    title="Emergency Response System API",
    description="Backend for incident management, dispatch, alerts, and voice/text commands.",
    version="1.0.0",
    lifespan=lifespan,
)



origins = [
    "http://localhost:5173",
    os.getenv("FRONTEND_URL", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents_router)
app.include_router(resources_router)
app.include_router(dispatch_router)
app.include_router(alerts_router)
app.include_router(command_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_text(
            json.dumps({"event": "connected", "message": "WebSocket ready"})
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
