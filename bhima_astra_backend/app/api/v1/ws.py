from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.connection_manager import manager
import asyncio

router = APIRouter()


@router.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time live updates."""
    await manager.connect(websocket)
    try:
        while True:
            # Simply wait for incoming data or disconnection
            # This will block indefinitely until client sends data or disconnects
            data = await websocket.receive_text()
            print(f"Received from client: {data}")
    except WebSocketDisconnect:
        print(f"Client disconnected")
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)