"""
Liabilities router — CRUD for debts/loans.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import LiabilityCreate, LiabilityUpdate, APIResponse
from app.routers.auth import get_current_user
from app.services import firestore_service as fs

router = APIRouter(prefix="/api/liabilities", tags=["liabilities"])


@router.get("", response_model=APIResponse)
async def list_liabilities(user: dict = Depends(get_current_user)):
    data = fs.get_liabilities(user["sub"], user["type"])
    return APIResponse(data=data)


@router.post("", response_model=APIResponse)
async def create_liability(liability: LiabilityCreate,
                           user: dict = Depends(get_current_user)):
    doc_id = fs.add_liability(user["sub"], user["type"], liability.model_dump())
    return APIResponse(data={"id": doc_id})


@router.put("/{liability_id}", response_model=APIResponse)
async def update_liability(liability_id: str, liability: LiabilityUpdate,
                           user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in liability.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    fs.update_liability(user["sub"], user["type"], liability_id, update_data)
    return APIResponse(data={"updated": liability_id})


@router.delete("/{liability_id}", response_model=APIResponse)
async def remove_liability(liability_id: str, user: dict = Depends(get_current_user)):
    fs.delete_liability(user["sub"], user["type"], liability_id)
    return APIResponse(data={"deleted": liability_id})
