import asyncio
from app.websocket.connection_manager import manager


async def send_ws_event(message: dict):
    """Broadcast a message to all connected websocket clients."""
    print(f"Sending WS event: {message}")
    await manager.broadcast(message)


def send_ws_event_sync(message: dict):
    """Broadcast a message from synchronous context."""
    print(f"Sending WS event (sync): {message}")
    try:
        # Get the running event loop and schedule the broadcast
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast(message))
    except RuntimeError:
        # No running event loop, try to get the event loop
        try:
            loop = asyncio.get_event_loop()
            loop.create_task(manager.broadcast(message))
        except Exception as e:
            print(f"Failed to schedule WS broadcast: {e}")
