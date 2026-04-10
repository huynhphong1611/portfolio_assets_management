"""
Funds router — CRUD for investment fund categories.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import FundCreate, FundUpdate, APIResponse
from app.routers.auth import get_current_user
from app.services import firestore_service as fs

router = APIRouter(prefix="/api/funds", tags=["funds"])


@router.get("", response_model=APIResponse)
async def list_funds(user: dict = Depends(get_current_user)):
    """List all funds."""
    data = fs.get_funds(user["sub"], user["type"])
    return APIResponse(data=data)


@router.post("", response_model=APIResponse)
async def create_fund(fund: FundCreate, user: dict = Depends(get_current_user)):
    """Add a new fund."""
    doc_id = fs.add_fund(user["sub"], user["type"], fund.model_dump())
    return APIResponse(data={"id": doc_id})


@router.put("/{fund_id}", response_model=APIResponse)
async def update_fund(fund_id: str, fund: FundUpdate,
                      user: dict = Depends(get_current_user)):
    """Update a fund."""
    update_data = {k: v for k, v in fund.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    fs.update_fund(user["sub"], user["type"], fund_id, update_data)
    return APIResponse(data={"updated": fund_id})


@router.delete("/{fund_id}", response_model=APIResponse)
async def remove_fund(fund_id: str, user: dict = Depends(get_current_user)):
    """Delete a fund."""
    fs.delete_fund(user["sub"], user["type"], fund_id)
    return APIResponse(data={"deleted": fund_id})


@router.post("/initialize", response_model=APIResponse)
async def initialize_defaults(user: dict = Depends(get_current_user)):
    """Create default fund categories if none exist."""
    created = fs.initialize_default_funds(user["sub"], user["type"])
    return APIResponse(data={"initialized": created})
