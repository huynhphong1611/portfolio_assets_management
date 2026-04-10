"""
Authentication service — JWT creation/verification, guest login, Firebase token verification.
"""
import hashlib
import time
import jwt
from app.config import settings
from app.firebase_init import get_db, get_firebase_auth


def hash_password(password: str) -> str:
    """Hash password with SHA-256 (matching frontend guest auth logic)."""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def create_jwt(user_id: str, username: str, user_type: str) -> str:
    """Create a JWT token for authenticated user."""
    payload = {
        "sub": user_id,
        "username": username,
        "type": user_type,
        "iat": int(time.time()),
        "exp": int(time.time()) + (settings.JWT_EXPIRE_HOURS * 3600),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_jwt(token: str) -> dict:
    """
    Verify and decode a JWT token.
    Returns payload dict with 'sub' (user_id), 'username', 'type'.
    Raises jwt.InvalidTokenError on failure.
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def get_user_collection_root(user_type: str) -> str:
    """Get the Firestore root collection name for a user type."""
    return "system_users" if user_type == "firebase" else "guest_users"


async def guest_login(username: str, password: str) -> dict | None:
    """
    Authenticate a guest user.
    Returns { id, username, type, token } on success, None on failure.
    """
    db = get_db()
    password_hash = hash_password(password)

    users_ref = db.collection("users")
    query = users_ref.where("username", "==", username).limit(1)
    docs = list(query.stream())

    if not docs:
        return None

    user_doc = docs[0]
    user_data = user_doc.to_dict()

    if user_data.get("passwordHash") != password_hash:
        return None

    token = create_jwt(user_doc.id, username, "guest")
    return {
        "id": user_doc.id,
        "username": username,
        "type": "guest",
        "token": token,
    }


async def guest_register(username: str, password: str) -> dict:
    """
    Register a new guest user.
    Returns { id, username, type, token }.
    Raises ValueError if username exists.
    """
    db = get_db()
    password_hash = hash_password(password)

    users_ref = db.collection("users")
    query = users_ref.where("username", "==", username).limit(1)
    existing = list(query.stream())

    if existing:
        raise ValueError("Tên đăng nhập đã tồn tại.")

    from google.cloud.firestore import SERVER_TIMESTAMP
    doc_ref = users_ref.add({
        "username": username,
        "passwordHash": password_hash,
        "createdAt": SERVER_TIMESTAMP,
    })

    # doc_ref is a tuple (timestamp, document_reference)
    user_id = doc_ref[1].id

    token = create_jwt(user_id, username, "guest")
    return {
        "id": user_id,
        "username": username,
        "type": "guest",
        "token": token,
    }


async def firebase_verify(id_token: str) -> dict:
    """
    Verify a Firebase ID token.
    Returns { id, username, type, token }.
    Raises ValueError on failure.
    """
    try:
        firebase_auth = get_firebase_auth()
        decoded = firebase_auth.verify_id_token(id_token)
        uid = decoded["uid"]
        email = decoded.get("email", "")
        name = decoded.get("name", email)

        token = create_jwt(uid, name, "firebase")
        return {
            "id": uid,
            "username": name,
            "type": "firebase",
            "token": token,
        }
    except Exception as e:
        raise ValueError(f"Firebase token verification failed: {e}")
