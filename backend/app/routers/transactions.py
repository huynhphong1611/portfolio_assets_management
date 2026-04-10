"""
Transactions router — CRUD for buy/sell/deposit transactions.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import TransactionCreate, APIResponse
from app.routers.auth import get_current_user
from app.services import firestore_service as fs

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("", response_model=APIResponse)
async def list_transactions(user: dict = Depends(get_current_user)):
    """List all transactions (ordered by date desc)."""
    data = fs.get_transactions(user["sub"], user["type"])
    return APIResponse(data=data)


@router.post("", response_model=APIResponse)
async def create_transaction(tx: TransactionCreate, user: dict = Depends(get_current_user)):
    """Add a new transaction."""
    tx_data = tx.model_dump()
    doc_id = fs.add_transaction(user["sub"], user["type"], tx_data)
    return APIResponse(data={"id": doc_id})


@router.put("/{tx_id}", response_model=APIResponse)
async def modify_transaction(tx_id: str, tx: TransactionCreate, user: dict = Depends(get_current_user)):
    """Update an existing transaction."""
    tx_data = tx.model_dump()
    fs.update_transaction(user["sub"], user["type"], tx_id, tx_data)
    return APIResponse(data={"updated": tx_id})


@router.delete("/{tx_id}", response_model=APIResponse)
async def remove_transaction(tx_id: str, user: dict = Depends(get_current_user)):
    """Delete a transaction."""
    try:
        fs.delete_transaction(user["sub"], user["type"], tx_id)
        return APIResponse(data={"deleted": tx_id})
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
