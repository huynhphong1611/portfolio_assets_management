"""
Auth router — Login, Register, Firebase verify.
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
import jwt as pyjwt

from app.models.schemas import (
    GuestLoginRequest, GuestRegisterRequest, FirebaseVerifyRequest,
    APIResponse, AuthResponse
)
from app.services.auth_service import (
    guest_login, guest_register, firebase_verify, verify_jwt
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Dependency: extract and verify user from Authorization header.
    Returns dict with 'sub' (user_id), 'username', 'type'.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Token required")

    try:
        payload = verify_jwt(token)
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/guest/login", response_model=APIResponse)
async def login_guest(req: GuestLoginRequest):
    """Authenticate guest user with username + password."""
    result = await guest_login(req.username, req.password)
    if not result:
        raise HTTPException(status_code=401, detail="Sai tài khoản hoặc mật khẩu")
    return APIResponse(data=result)


@router.post("/guest/register", response_model=APIResponse)
async def register_guest(req: GuestRegisterRequest):
    """Register a new guest user."""
    try:
        result = await guest_register(req.username, req.password)
        return APIResponse(data=result)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/firebase/verify", response_model=APIResponse)
async def verify_firebase_token(req: FirebaseVerifyRequest):
    """Verify Firebase ID token and return our JWT."""
    try:
        result = await firebase_verify(req.idToken)
        return APIResponse(data=result)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me", response_model=APIResponse)
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user info from JWT."""
    return APIResponse(data={
        "id": user["sub"],
        "username": user["username"],
        "type": user["type"],
    })
