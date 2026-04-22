"""
Pydantic models for request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Any, Optional, Literal


# ── Common Response ──

class APIResponse(BaseModel):
    """Standard API response wrapper."""
    success: bool = True
    data: Any = None
    error: Optional[str] = None


# ── Auth ──

class GuestLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1)

class GuestRegisterRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1)

class FirebaseVerifyRequest(BaseModel):
    idToken: str = Field(..., min_length=10)

class AuthResponse(BaseModel):
    token: str
    user: dict


# ── Transaction ──

class TransactionCreate(BaseModel):
    date: str
    transactionType: str
    assetClass: str
    ticker: str
    quantity: float
    unitPrice: float
    currency: str = "VNĐ"
    exchangeRate: float = 1
    costBasisValue: Optional[float] = 0
    totalVND: float
    pnlVND: Optional[float] = 0
    pnlPercent: Optional[float] = 0
    storage: Optional[str] = ""
    notes: Optional[str] = ""


# ── External Asset ──

class ExternalAssetCreate(BaseModel):
    name: str
    value: float = 0
    group: str = "Thanh khoản"

class ExternalAssetUpdate(BaseModel):
    name: Optional[str] = None
    value: Optional[float] = None
    group: Optional[str] = None


# ── Liability ──

class LiabilityCreate(BaseModel):
    name: str
    amount: float = 0
    type: str = "Vay cá nhân"
    interestRate: Optional[float] = 0
    notes: Optional[str] = ""

class LiabilityUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    interestRate: Optional[float] = None
    notes: Optional[str] = None


# ── Market Prices ──

class MarketPricesUpdate(BaseModel):
    prices: dict  # {ticker: {price, exchangeRate?, ...}} map


# ── Snapshot ──

class SnapshotCreate(BaseModel):
    date: str
    totalAssets: float = 0
    totalLiabilities: float = 0
    netWorth: float = 0
    portfolioValue: float = 0
    portfolioCost: float = 0
    portfolioPnL: float = 0
    portfolioPnLPercent: float = 0


# ── Settings ──

class RebalanceTargetsUpdate(BaseModel):
    targets: dict
