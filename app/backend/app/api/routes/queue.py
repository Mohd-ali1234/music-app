from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_queue_service
from app.domain import song_json
from app.schemas.queue import QueueGenIn
from app.services.recommendation import QueueService

router = APIRouter(tags=["queue"])


@router.post("/queue/generate")
def queue_generate(
    body: QueueGenIn,
    user=Depends(get_current_user),
    queue: QueueService = Depends(get_queue_service),
):
    items = queue.create_queue(
        seed_song_id=body.seed_song_id, user_id=user["id"], size=body.size
    )
    return {
        "songs": [song_json(item) for item in items],
        "seed_song_id": body.seed_song_id,
        "size": len(items),
    }


@router.get("/catalog/related")
def catalog_related(
    song_id: str,
    size: int = 20,
    user=Depends(get_current_user),
    queue: QueueService = Depends(get_queue_service),
):
    items = queue.create_queue(seed_song_id=song_id, user_id=user["id"], size=size)
    return {"songs": items}
