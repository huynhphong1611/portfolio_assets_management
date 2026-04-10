"""
Snapshots router — Daily net worth snapshots.
"""
from fastapi import APIRouter, Depends

from app.models.schemas import SnapshotCreate, APIResponse
from app.routers.auth import get_current_user
from app.services import firestore_service as fs

router = APIRouter(prefix="/api/snapshots", tags=["snapshots"])


@router.get("", response_model=APIResponse)
async def list_snapshots(user: dict = Depends(get_current_user)):
    """List all daily snapshots (ordered by date asc)."""
    data = fs.get_snapshots(user["sub"], user["type"])
    return APIResponse(data=data)


@router.post("", response_model=APIResponse)
async def save_snapshot(snapshot: SnapshotCreate,
                        user: dict = Depends(get_current_user)):
    """Save or update daily snapshot for a date."""
    fs.save_snapshot(user["sub"], user["type"],
                     snapshot.date, snapshot.model_dump())
    return APIResponse(data={"saved": snapshot.date})
