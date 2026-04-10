"""
Settings router — Rebalance targets and user preferences.
"""
from fastapi import APIRouter, Depends

from app.models.schemas import RebalanceTargetsUpdate, APIResponse
from app.routers.auth import get_current_user
from app.services import firestore_service as fs

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/rebalance", response_model=APIResponse)
async def get_rebalance_targets(user: dict = Depends(get_current_user)):
    """Get rebalance target weights."""
    data = fs.get_rebalance_targets(user["sub"], user["type"])
    return APIResponse(data=data)


@router.put("/rebalance", response_model=APIResponse)
async def save_rebalance_targets(req: RebalanceTargetsUpdate,
                                 user: dict = Depends(get_current_user)):
    """Save rebalance target weights."""
    fs.save_rebalance_targets(user["sub"], user["type"], req.targets)
    return APIResponse(data={"saved": True})
