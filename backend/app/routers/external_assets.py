"""
External Assets router — CRUD for assets outside the portfolio.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import ExternalAssetCreate, ExternalAssetUpdate, APIResponse
from app.routers.auth import get_current_user
from app.services import firestore_service as fs

router = APIRouter(prefix="/api/external-assets", tags=["external-assets"])


@router.get("", response_model=APIResponse)
async def list_external_assets(user: dict = Depends(get_current_user)):
    data = fs.get_external_assets(user["sub"], user["type"])
    return APIResponse(data=data)


@router.post("", response_model=APIResponse)
async def create_external_asset(asset: ExternalAssetCreate,
                                user: dict = Depends(get_current_user)):
    doc_id = fs.add_external_asset(user["sub"], user["type"], asset.model_dump())
    return APIResponse(data={"id": doc_id})


@router.put("/{asset_id}", response_model=APIResponse)
async def update_external_asset(asset_id: str, asset: ExternalAssetUpdate,
                                user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in asset.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    fs.update_external_asset(user["sub"], user["type"], asset_id, update_data)
    return APIResponse(data={"updated": asset_id})


@router.delete("/{asset_id}", response_model=APIResponse)
async def remove_external_asset(asset_id: str, user: dict = Depends(get_current_user)):
    fs.delete_external_asset(user["sub"], user["type"], asset_id)
    return APIResponse(data={"deleted": asset_id})
